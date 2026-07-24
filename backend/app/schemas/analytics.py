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
