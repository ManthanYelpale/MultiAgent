from typing import Any
from pydantic import BaseModel, Field


class ForecastRequest(BaseModel):
    file_id: int
    target_column: str
    date_column: str | None = None
    horizon: int = Field(default=5, ge=1, le=30)


class ForecastResponse(BaseModel):
    target_column: str
    historical: list[dict[str, Any]]
    forecast: list[dict[str, Any]]
    method: str


class AnomalyRequest(BaseModel):
    file_id: int
    feature_columns: list[str] | None = None
    contamination: float = Field(default=0.05, ge=0.01, le=0.5)


class AnomalyItem(BaseModel):
    row_index: int
    data: dict[str, Any]
    anomaly_score: float


class AnomalyResponse(BaseModel):
    file_id: int
    total_rows: int
    anomaly_count: int
    anomalies: list[AnomalyItem]


class InsightsRequest(BaseModel):
    file_id: int


class InsightsResponse(BaseModel):
    file_id: int
    filename: str
    insights_summary: str


class TrendRequest(BaseModel):
    file_id: int
    target_column: str
    window: int = Field(default=5, ge=2, le=30)

class TrendResponse(BaseModel):
    target_column: str
    recent_avg: float
    prior_avg: float
    pct_change: float
    trend: str
    window: int


class SegmentationRequest(BaseModel):
    file_id: int
    n_clusters: int = Field(default=4, ge=2, le=10)
    id_column: str | None = None
    date_column: str | None = None
    monetary_column: str | None = None


class SegmentationResponse(BaseModel):
    file_id: int
    n_clusters: int
    cluster_summary: list[dict[str, Any]]
    feature_columns: list[str]


class ColumnsListResponse(BaseModel):
    file_id: int
    columns: list[str]

