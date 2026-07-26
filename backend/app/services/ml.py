import logging
from typing import Any
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

try:
    from sklearn.ensemble import IsolationForest
    from sklearn.linear_model import LinearRegression
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler
except ImportError:
    IsolationForest = None
    LinearRegression = None
    KMeans = None
    StandardScaler = None

from app.services.llm import llm
from app.services.prompts import prompts

class MLService:
    @staticmethod
    def forecast(df: pd.DataFrame, target_column: str, date_column: str | None = None, horizon: int = 5) -> dict[str, Any]:
        if target_column not in df.columns:
            raise ValueError(f"Column '{target_column}' not found in dataframe.")

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

        X = np.arange(len(series)).reshape(-1, 1)
        y = series.values

        if LinearRegression is not None:
            model = LinearRegression()
            model.fit(X, y)
            future_X = np.arange(len(series), len(series) + horizon).reshape(-1, 1)
            predictions = model.predict(future_X)
            method = "LinearRegression Trend Model"
        else:
            slope = (y[-1] - y[0]) / max(1, len(y) - 1)
            predictions = [y[-1] + slope * i for i in range(1, horizon + 1)]
            method = "Simple Linear Trend (Fallback)"

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
            "method": method,
        }

    @staticmethod
    def detect_trends(df: pd.DataFrame, target_column: str, window: int = 5) -> dict[str, Any]:
        if target_column not in df.columns:
            raise ValueError(f"Column '{target_column}' not found in dataframe.")
            
        series = pd.to_numeric(df[target_column], errors="coerce").dropna()
        if len(series) < window * 2:
            raise ValueError(f"Need at least {window * 2} data points for robust trend detection.")
            
        recent = series.iloc[-window:].mean()
        prior = series.iloc[-window*2:-window].mean()
        
        if prior == 0:
            pct_change = 0 if recent == 0 else 100
        else:
            pct_change = ((recent - prior) / prior) * 100
            
        if pct_change > 5:
            trend = "increasing"
        elif pct_change < -5:
            trend = "decreasing"
        else:
            trend = "flat"
            
        return {
            "target_column": target_column,
            "recent_avg": float(recent),
            "prior_avg": float(prior),
            "pct_change": float(pct_change),
            "trend": trend,
            "window": window
        }

    @staticmethod
    def detect_anomalies(df: pd.DataFrame, feature_columns: list[str] | None = None, contamination: float = 0.05) -> dict[str, Any]:
        if not feature_columns:
            numeric_df = df.select_dtypes(include=[np.number])
        else:
            numeric_df = df[feature_columns].select_dtypes(include=[np.number])

        numeric_df = numeric_df.dropna()
        if numeric_df.empty or len(numeric_df) < 5:
            return {"total_rows": len(df), "anomaly_count": 0, "anomalies": []}

        if IsolationForest is not None:
            clf = IsolationForest(contamination=contamination, random_state=42)
            preds = clf.fit_predict(numeric_df)
            scores = clf.decision_function(numeric_df)
            anomalies = []
            # numeric_df has had NaN rows dropped, so its positional offsets no longer
            # line up with df. Map back through the preserved index instead — using the
            # positional offset reported innocent rows as anomalies.
            for position, (pred, score) in enumerate(zip(preds, scores)):
                if pred == -1:
                    label = numeric_df.index[position]
                    row_data = df.loc[label].to_dict()
                    clean_row = {k: (v if pd.notna(v) else None) for k, v in row_data.items()}
                    anomalies.append({"row_index": int(label), "data": clean_row, "anomaly_score": round(float(-score), 4)})
        else:
            anomalies = []
            col = numeric_df.columns[0]
            vals = numeric_df[col].values
            mean, std = np.mean(vals), np.std(vals)
            if std > 0:
                z_scores = np.abs((vals - mean) / std)
                # Same index-mapping fix as the IsolationForest branch above.
                for position, (z, val) in enumerate(zip(z_scores, vals)):
                    if z > 2.5:
                        label = numeric_df.index[position]
                        anomalies.append({"row_index": int(label), "data": {col: float(val)}, "anomaly_score": round(float(z), 4)})

        return {"total_rows": len(df), "anomaly_count": len(anomalies), "anomalies": anomalies}

    @staticmethod
    def segment_customers(
        df: pd.DataFrame,
        n_clusters: int = 4,
        id_column: str | None = None,
        date_column: str | None = None,
        monetary_column: str | None = None
    ) -> dict[str, Any]:
        if KMeans is None or StandardScaler is None:
            raise ImportError("scikit-learn is required for customer segmentation.")
            
        id_col = id_column if id_column and id_column in df.columns else next((c for c in df.columns if 'id' in c.lower() or 'customer' in c.lower()), None)
        date_col = date_column if date_column and date_column in df.columns else next((c for c in df.columns if 'date' in c.lower() or 'time' in c.lower()), None)
        amt_col = monetary_column if monetary_column and monetary_column in df.columns else next((c for c in df.columns if 'amount' in c.lower() or 'price' in c.lower() or 'total' in c.lower() or 'revenue' in c.lower() or 'sales' in c.lower()), None)
        
        if not (id_col and amt_col):
            # Fallback if no RFM: just segment on all numerics
            numeric_df = df.select_dtypes(include=[np.number]).dropna()
            if numeric_df.empty or len(numeric_df) < n_clusters:
                raise ValueError("Could not auto-detect RFM columns, and fallback numeric data is insufficient for segmentation.")
            
            features = numeric_df
            id_series = numeric_df.index
        else:
            # Build RFM
            rfm_df = df.copy()
            rfm_df[amt_col] = pd.to_numeric(rfm_df[amt_col], errors='coerce')
            rfm_df = rfm_df.dropna(subset=[id_col, amt_col])
            
            if date_col:
                rfm_df[date_col] = pd.to_datetime(rfm_df[date_col], errors='coerce')
                rfm_df = rfm_df.dropna(subset=[date_col])
                max_date = rfm_df[date_col].max()
                
                grouped = rfm_df.groupby(id_col).agg({
                    date_col: lambda x: (max_date - x.max()).days, # Recency
                    id_col: 'count',                               # Frequency
                    amt_col: 'sum'                                 # Monetary
                }).rename(columns={date_col: 'Recency', id_col: 'Frequency', amt_col: 'Monetary'})
            else:
                grouped = rfm_df.groupby(id_col).agg({
                    id_col: 'count',
                    amt_col: 'sum'
                }).rename(columns={id_col: 'Frequency', amt_col: 'Monetary'})
                
            features = grouped
            id_series = grouped.index
            
        if len(features) < n_clusters:
            raise ValueError(f"Not enough distinct entities to form {n_clusters} clusters. Found {len(features)}.")
            
        scaler = StandardScaler()
        scaled_features = scaler.fit_transform(features)
        
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        kmeans.fit(scaled_features)
        
        features['Cluster'] = kmeans.labels_
        
        # Summarize clusters
        cluster_summary = []
        for i in range(n_clusters):
            cluster_data = features[features['Cluster'] == i]
            summary = {"cluster_id": i, "size": len(cluster_data)}
            for col in features.columns:
                if col != 'Cluster':
                    summary[f"avg_{col.lower()}"] = round(float(cluster_data[col].mean()), 2)
            cluster_summary.append(summary)
            
        return {
            "n_clusters": n_clusters,
            "cluster_summary": cluster_summary,
            "feature_columns": list(features.columns[:-1])
        }

# Maintain backward compatibility for reports and existing scripts temporarily
def run_forecast(*args, **kwargs):
    return MLService.forecast(*args, **kwargs)
    
def detect_anomalies(*args, **kwargs):
    return MLService.detect_anomalies(*args, **kwargs)

def generate_ai_insights(filename: str, df: pd.DataFrame, anomalies_info: dict[str, Any] | None = None, forecast_info: dict[str, Any] | None = None) -> str:
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

    return llm.chat_completion(messages, temperature=0.5, max_tokens=512)

def generate_kpi_insight(metric_name: str, metric_value: str, agg_function: str, dataset_name: str) -> str:
    system_prompt = prompts.render(
        "insight_generator",
        metric_name=metric_name,
        metric_value=metric_value,
        agg_function=agg_function,
        dataset_name=dataset_name
    )
    messages = [{"role": "system", "content": system_prompt}]
    return llm.chat_completion(messages, temperature=0.3, max_tokens=100)
