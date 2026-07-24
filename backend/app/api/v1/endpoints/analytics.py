import os

from fastapi import APIRouter, Depends, HTTPException
import pandas as pd
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.crud.uploaded_file import get_file_for_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.analytics import (
    AnomalyRequest,
    AnomalyResponse,
    ForecastRequest,
    ForecastResponse,
    InsightsRequest,
    InsightsResponse,
)
from app.services.ml import detect_anomalies, generate_ai_insights, run_forecast

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _load_dataframe(stored_filename: str, file_type: str) -> pd.DataFrame:
    path = os.path.join(settings.UPLOAD_DIR, stored_filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File missing on disk")

    if file_type == "csv":
        return pd.read_csv(path)
    elif file_type == "xlsx":
        return pd.read_excel(path)
    else:
        raise HTTPException(status_code=400, detail="Analytics can only be run on tabular files (CSV or Excel)")


@router.post("/forecast", response_model=ForecastResponse)
def forecast_metric(
    request: ForecastRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = get_file_for_user(db, current_user.id, request.file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    df = _load_dataframe(db_file.stored_filename, db_file.file_type)
    try:
        res = run_forecast(
            df=df,
            target_column=request.target_column,
            date_column=request.date_column,
            horizon=request.horizon,
        )
        return ForecastResponse(**res)
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Forecasting error: {exc}")


@router.post("/anomalies", response_model=AnomalyResponse)
def get_anomalies(
    request: AnomalyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = get_file_for_user(db, current_user.id, request.file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    df = _load_dataframe(db_file.stored_filename, db_file.file_type)
    try:
        res = detect_anomalies(
            df=df,
            feature_columns=request.feature_columns,
            contamination=request.contamination,
        )
        return AnomalyResponse(file_id=db_file.id, **res)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Anomaly detection error: {exc}")


@router.post("/insights", response_model=InsightsResponse)
def get_ai_insights(
    request: InsightsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = get_file_for_user(db, current_user.id, request.file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    df = _load_dataframe(db_file.stored_filename, db_file.file_type)
    try:
        anomalies_res = detect_anomalies(df)
        summary_text = generate_ai_insights(
            filename=db_file.original_filename,
            df=df,
            anomalies_info=anomalies_res,
        )
        return InsightsResponse(
            file_id=db_file.id,
            filename=db_file.original_filename,
            insights_summary=summary_text,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI Insights error: {exc}")
