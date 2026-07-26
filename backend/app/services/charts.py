"""Chart data computation.

Extracted from the dashboards endpoint so the reports endpoint can reuse it without
importing and calling a route handler (which bypassed response validation and coupled
the two modules). Both the /dashboards/charts/data route and report generation call
`compute_chart_data`.
"""

import logging
from typing import Any

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.crud.uploaded_file import get_file_for_user
from app.models.cleaning import CleanedDataset
from app.services.storage import get_storage_service

logger = logging.getLogger(__name__)

# Group-by results are truncated to this many categories. Applied via nlargest BEFORE
# building the full python list, so a high-cardinality column cannot materialise millions
# of rows in memory.
MAX_GROUPS = 20
SUPPORTED_AGGS = {"sum", "mean", "count", "min", "max"}


class ChartError(Exception):
    """Raised for user-actionable chart configuration problems."""


def _resolve_dataframe(db: Session, user_id: int, file_id: int) -> tuple[pd.DataFrame, list[str]]:
    db_file = get_file_for_user(db, user_id, file_id)
    if not db_file:
        raise ChartError("File not found")
    if db_file.file_type not in ("csv", "xlsx"):
        raise ChartError("Charts are only supported for tabular files")

    storage = get_storage_service()
    warnings: list[str] = []
    cleaned = db.query(CleanedDataset).filter(CleanedDataset.file_id == file_id).first()

    import os
    path = None
    if cleaned and not cleaned.skipped and cleaned.storage_path:
        candidate = storage.get_file_path(user_id, cleaned.storage_path)
        if os.path.isfile(candidate):
            path = candidate
    if cleaned and cleaned.skipped:
        warnings.append("⚠ Cleaning was skipped. Data may contain anomalies.")
    if path is None:
        candidate = storage.get_file_path(user_id, db_file.stored_filename)
        if os.path.isfile(candidate):
            path = candidate
    if path is None:
        raise ChartError("File missing on disk")

    df = pd.read_csv(path) if db_file.file_type == "csv" else pd.read_excel(path)
    return df, warnings


def _to_native(value: Any) -> Any:
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return round(float(value), 2)
    if isinstance(value, float):
        return round(value, 2)
    return value


def compute_chart_data(
    db: Session,
    user_id: int,
    file_id: int,
    chart_type: str,
    x_column: str | None,
    y_column: str | None,
    agg_function: str | None,
) -> dict[str, Any]:
    df, warnings = _resolve_dataframe(db, user_id, file_id)
    agg = (agg_function or "sum").lower()
    if agg not in SUPPORTED_AGGS:
        raise ChartError(f"Unsupported aggregation '{agg_function}'")

    if chart_type == "kpi":
        value: Any = 0
        if y_column and y_column in df.columns:
            if agg == "count":
                value = int(df[y_column].count())
            else:
                series = pd.to_numeric(df[y_column], errors="coerce")
                value = getattr(series, agg)()
                value = _to_native(value) if pd.notna(value) else 0
        return {
            "chart_type": chart_type, "x_column": x_column, "y_column": y_column,
            "agg_function": agg, "data": {"value": value}, "warnings": warnings,
        }

    if not x_column or x_column not in df.columns:
        return {"chart_type": chart_type, "x_column": x_column, "y_column": y_column,
                "agg_function": agg, "data": [], "warnings": warnings}

    if pd.api.types.is_datetime64_any_dtype(df[x_column]):
        df[x_column] = df[x_column].dt.strftime("%Y-%m-%d")

    if agg == "count":
        grouped = df.groupby(x_column).size()
    else:
        if not y_column or y_column not in df.columns:
            return {"chart_type": chart_type, "x_column": x_column, "y_column": y_column,
                    "agg_function": agg, "data": [], "warnings": warnings}
        numeric = pd.to_numeric(df[y_column], errors="coerce")
        grouped = numeric.groupby(df[x_column]).agg(agg)

    grouped = grouped.dropna()
    # Truncate high-cardinality groupings before materialising to python objects.
    if chart_type in ("bar", "pie"):
        grouped = grouped.nlargest(MAX_GROUPS)
    elif len(grouped) > 1000:
        # Even a time series shouldn't ship an unbounded payload to the browser.
        grouped = grouped.tail(1000)
        warnings.append("Showing the most recent 1000 points.")

    data = [{"name": str(idx), "value": _to_native(val)} for idx, val in grouped.items()]
    return {
        "chart_type": chart_type, "x_column": x_column, "y_column": y_column,
        "agg_function": agg, "data": data, "warnings": warnings,
    }
