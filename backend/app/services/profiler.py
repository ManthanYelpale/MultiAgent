import json
import os
from typing import Any, Dict, Tuple

import pandas as pd

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None


def profile_tabular_file(path: str, file_type: str) -> Tuple[int, int, Dict[str, Any]]:
    if file_type == "csv":
        df = pd.read_csv(path)
    elif file_type == "xlsx":
        df = pd.read_excel(path)
    else:
        raise ValueError("Unsupported tabular file type")

    row_count = len(df)
    column_count = len(df.columns)

    if row_count == 0:
        return 0, column_count, {"error": "Empty file"}

    # 1. Preview
    preview_data = df.head(10).fillna("").to_dict(orient="records")

    # 2. Dtype inference
    dtypes_info = {}
    null_detection = {}
    cleaning_suggestions = []

    for col in df.columns:
        series = df[col]
        dtype = str(series.dtype)

        # nulls
        null_count = int(series.isnull().sum())
        null_pct = (null_count / row_count) * 100 if row_count > 0 else 0
        null_detection[col] = {"count": null_count, "percentage": round(null_pct, 2)}

        if null_pct > 40:
            cleaning_suggestions.append(f"Column '{col}' has {round(null_pct, 1)}% null values. Consider dropping or imputing.")

        # smart dtype inference
        if pd.api.types.is_numeric_dtype(series):
            inferred_type = "Numeric"
        elif pd.api.types.is_datetime64_any_dtype(series):
            inferred_type = "Datetime"
        else:
            unique_count = series.nunique()
            if unique_count > 0 and (unique_count / row_count) < 0.05 and unique_count < 100:
                inferred_type = "Categorical"
            else:
                inferred_type = "Text"

        dtypes_info[col] = {"raw": dtype, "inferred": inferred_type}

    # 3. Duplicates
    duplicate_count = int(df.duplicated().sum())
    if duplicate_count > 0:
        cleaning_suggestions.append(f"Found {duplicate_count} exact duplicate rows. Consider dropping them.")

    overall_null_pct = round((df.isnull().sum().sum() / (row_count * column_count)) * 100, 2) if row_count * column_count > 0 else 0

    profile = {
        "columns": list(df.columns),
        "preview": preview_data,
        "dtypes": dtypes_info,
        "nulls": {
            "per_column": null_detection,
            "overall_percentage": overall_null_pct
        },
        "duplicates": duplicate_count,
        "suggestions": cleaning_suggestions
    }

    return row_count, column_count, profile


def profile_pdf_file(path: str) -> Tuple[int, int, Dict[str, Any]]:
    if not PdfReader:
        return 0, 0, {"error": "pypdf not installed"}

    reader = PdfReader(path)
    page_count = len(reader.pages)

    text_content = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            text_content.append(text)

    full_text = "\n".join(text_content)
    char_count = len(full_text)

    # Save text to a sidecar file
    txt_path = path + ".txt"
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(full_text)

    profile = {
        "preview": full_text[:500] + "..." if char_count > 500 else full_text,
        "page_count": page_count,
        "char_count": char_count,
        "text_file_path": txt_path
    }

    return page_count, 1, profile


def run_profiler(path: str, file_type: str) -> Tuple[int | None, int | None, str | None]:
    try:
        if file_type in ["csv", "xlsx"]:
            rows, cols, profile = profile_tabular_file(path, file_type)
        elif file_type == "pdf":
            rows, cols, profile = profile_pdf_file(path)
        else:
            return None, None, None

        return rows, cols, json.dumps(profile)
    except Exception as e:
        print(f"Profiling error: {e}")
        return None, None, None
