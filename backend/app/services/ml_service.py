import logging
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

try:
    from sklearn.ensemble import IsolationForest
    from sklearn.linear_model import LinearRegression
except ImportError:
    IsolationForest = None
    LinearRegression = None

from app.services.groq_service import groq_service
from app.services.prompt_manager import prompt_manager


def run_forecast(
    df: pd.DataFrame,
    target_column: str,
    date_column: str | None = None,
    horizon: int = 5,
) -> dict[str, Any]:
    if target_column not in df.columns:
        raise ValueError(f"Column '{target_column}' not found in dataframe.")

    # Clean target series
    series = pd.to_numeric(df[target_column], errors="coerce").dropna()
    if len(series) < 3:
        raise ValueError("Insufficient numerical data points for forecasting (minimum 3 required).")

    historical = []
    if date_column and date_column in df.columns:
        dates = df.loc[series.index, date_column].astype(str).tolist()
        for d, val in zip(dates, series.values):
            historical.append({"date": d, "value": float(val)})
    else:
        for idx, val in enumerate(series.values, start=1):
            historical.append({"period": idx, "value": float(val)})

    # Fit linear regression trend model
    X = np.arange(len(series)).reshape(-1, 1)
    y = series.values

    if LinearRegression is not None:
        model = LinearRegression()
        model.fit(X, y)

        future_X = np.arange(len(series), len(series) + horizon).reshape(-1, 1)
        predictions = model.predict(future_X)
    else:
        # Fallback simple linear trend
        slope = (y[-1] - y[0]) / max(1, len(y) - 1)
        predictions = [y[-1] + slope * i for i in range(1, horizon + 1)]

    forecast = []
    for i, pred_val in enumerate(predictions, start=1):
        if historical and "date" in historical[0]:
            label = f"Future +{i}"
        else:
            label = f"Period {len(series) + i}"

        forecast.append({"period_label": label, "forecast_value": round(float(pred_val), 2)})

    return {
        "target_column": target_column,
        "historical": historical,
        "forecast": forecast,
        "method": "LinearRegression Trend Model",
    }


def detect_anomalies(
    df: pd.DataFrame,
    feature_columns: list[str] | None = None,
    contamination: float = 0.05,
) -> dict[str, Any]:
    # Filter numerical columns
    if not feature_columns:
        numeric_df = df.select_dtypes(include=[np.number])
    else:
        numeric_df = df[feature_columns].select_dtypes(include=[np.number])

    numeric_df = numeric_df.dropna()
    if numeric_df.empty or len(numeric_df) < 5:
        return {
            "total_rows": len(df),
            "anomaly_count": 0,
            "anomalies": [],
        }

    if IsolationForest is not None:
        clf = IsolationForest(contamination=contamination, random_state=42)
        preds = clf.fit_predict(numeric_df)
        scores = clf.decision_function(numeric_df)

        anomalies = []
        for orig_idx, (pred, score) in enumerate(zip(preds, scores)):
            if pred == -1:  # Outlier flagged
                row_data = df.iloc[orig_idx].to_dict()
                # Clean NaNs in row_data for JSON serialization
                clean_row = {k: (v if pd.notna(v) else None) for k, v in row_data.items()}
                anomalies.append(
                    {
                        "row_index": int(orig_idx),
                        "data": clean_row,
                        "anomaly_score": round(float(-score), 4),
                    }
                )
    else:
        # Z-score fallback for single column
        anomalies = []
        col = numeric_df.columns[0]
        vals = numeric_df[col].values
        mean, std = np.mean(vals), np.std(vals)
        if std > 0:
            z_scores = np.abs((vals - mean) / std)
            for idx, (z, val) in enumerate(zip(z_scores, vals)):
                if z > 2.5:
                    anomalies.append(
                        {
                            "row_index": int(idx),
                            "data": {col: float(val)},
                            "anomaly_score": round(float(z), 4),
                        }
                    )

    return {
        "total_rows": len(df),
        "anomaly_count": len(anomalies),
        "anomalies": anomalies,
    }


def generate_ai_insights(
    filename: str,
    df: pd.DataFrame,
    anomalies_info: dict[str, Any] | None = None,
    forecast_info: dict[str, Any] | None = None,
) -> str:
    # Summary statistics
    numeric_df = df.select_dtypes(include=[np.number])
    stats_desc = numeric_df.describe().to_string() if not numeric_df.empty else "No numeric columns."

    prompt = (
        f"File: {filename}\n"
        f"Rows: {len(df)}, Columns: {list(df.columns)}\n\n"
        f"Summary Statistics:\n{stats_desc}\n\n"
    )

    if anomalies_info:
        prompt += (
            f"Anomaly Detection Results:\n"
            f"Flagged {anomalies_info.get('anomaly_count', 0)} anomalies out of {anomalies_info.get('total_rows', 0)} rows.\n"
        )

    if forecast_info:
        prompt += (
            f"Metric Forecast Results:\n"
            f"Target: {forecast_info.get('target_column')}\n"
            f"Projected Forecast: {forecast_info.get('forecast')}\n"
        )

    system_prompt = (
        "You are an expert AI business intelligence analyst. Write a concise, professional executive "
        "summary paragraph (3-5 sentences) providing actionable insights based on the statistical metrics, "
        "anomaly detection flags, and metric projections provided."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt},
    ]

    return groq_service.chat_completion(messages, temperature=0.5, max_tokens=512)

def generate_kpi_insight(
    metric_name: str,
    metric_value: str,
    agg_function: str,
    dataset_name: str
) -> str:
    system_prompt = prompt_manager.render(
        "insight_generator",
        metric_name=metric_name,
        metric_value=metric_value,
        agg_function=agg_function,
        dataset_name=dataset_name
    )
    messages = [{"role": "system", "content": system_prompt}]
    return groq_service.chat_completion(messages, temperature=0.3, max_tokens=100)
