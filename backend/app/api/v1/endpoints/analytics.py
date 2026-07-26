import logging
import os

from fastapi import APIRouter, Depends, HTTPException
import pandas as pd
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.crud.uploaded_file import get_file_for_user
from app.db.session import get_db
from app.models.user import User
from app.models.cleaning import CleanedDataset
from app.services.storage import get_storage_service
from app.schemas.analytics import (
    AnomalyRequest,
    AnomalyResponse,
    ColumnsListResponse,
    ForecastRequest,
    ForecastResponse,
    InsightsRequest,
    InsightsResponse,
    SegmentationRequest,
    SegmentationResponse,
    TrendRequest,
    TrendResponse,
)
from app.services.ml import MLService, detect_anomalies, generate_ai_insights, run_forecast

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])
datasets_analytics_router = APIRouter(prefix="/datasets", tags=["analytics"])


def _load_user_dataframe(file_id: int, current_user_id: int, db: Session) -> pd.DataFrame:
    db_file = get_file_for_user(db, current_user_id, file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    storage = get_storage_service()
    cleaned = db.query(CleanedDataset).filter(CleanedDataset.file_id == file_id).first()

    # Skipped cleaning stores an empty storage_path. Joining "" yields the user's
    # upload *directory*, which os.path.exists() reports as True — so the raw-file
    # fallback below never fired and pandas got handed a directory.
    path = None
    if cleaned and not cleaned.skipped and cleaned.storage_path:
        candidate = storage.get_file_path(current_user_id, cleaned.storage_path)
        if os.path.isfile(candidate):
            path = candidate
    if path is None:
        candidate = storage.get_file_path(current_user_id, db_file.stored_filename)
        if os.path.isfile(candidate):
            path = candidate
    if path is None:
        raise HTTPException(status_code=404, detail="File missing on disk")

    if db_file.file_type == "csv":
        return pd.read_csv(path)
    elif db_file.file_type == "xlsx":
        return pd.read_excel(path)
    else:
        raise HTTPException(status_code=400, detail="Analytics can only be run on tabular files (CSV or Excel)")


@router.get("/file/{file_id}/columns", response_model=ColumnsListResponse)
@datasets_analytics_router.get("/{file_id}/columns", response_model=ColumnsListResponse)
def get_dataset_columns(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    df = _load_user_dataframe(file_id, current_user.id, db)
    return ColumnsListResponse(
        file_id=file_id,
        columns=[str(col) for col in df.columns]
    )


@router.post("/forecast", response_model=ForecastResponse)
def forecast_metric(
    request: ForecastRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    df = _load_user_dataframe(request.file_id, current_user.id, db)
    try:
        res = MLService.forecast(
            df=df,
            target_column=request.target_column,
            date_column=request.date_column,
            horizon=request.horizon,
        )
        return ForecastResponse(**res)
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception:
        logger.exception("Unhandled error in %s", __name__)
        raise HTTPException(status_code=500, detail="Forecasting failed. Please check your inputs and try again.")


@router.post("/trend", response_model=TrendResponse)
def analyze_trend(
    request: TrendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    df = _load_user_dataframe(request.file_id, current_user.id, db)
    try:
        res = MLService.detect_trends(
            df=df,
            target_column=request.target_column,
            window=request.window,
        )
        return TrendResponse(**res)
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception:
        logger.exception("Unhandled error in %s", __name__)
        raise HTTPException(status_code=500, detail="Trend analysis failed. Please check your inputs and try again.")


@router.post("/anomalies", response_model=AnomalyResponse)
def get_anomalies(
    request: AnomalyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = get_file_for_user(db, current_user.id, request.file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    df = _load_user_dataframe(request.file_id, current_user.id, db)
    try:
        res = MLService.detect_anomalies(
            df=df,
            feature_columns=request.feature_columns,
            contamination=request.contamination,
        )
        return AnomalyResponse(file_id=db_file.id, **res)
    except Exception:
        logger.exception("Unhandled error in %s", __name__)
        raise HTTPException(status_code=500, detail="Anomaly detection failed. Please check your inputs and try again.")


@router.post("/segmentation", response_model=SegmentationResponse)
def segment_customers_endpoint(
    request: SegmentationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    df = _load_user_dataframe(request.file_id, current_user.id, db)
    try:
        res = MLService.segment_customers(
            df=df,
            n_clusters=request.n_clusters,
            id_column=request.id_column,
            date_column=request.date_column,
            monetary_column=request.monetary_column,
        )
        return SegmentationResponse(file_id=request.file_id, **res)
    except Exception:
        logger.exception("Unhandled error in %s", __name__)
        raise HTTPException(status_code=500, detail="Segmentation failed. Please check your inputs and try again.")


@router.post("/insights", response_model=InsightsResponse)
def get_ai_insights(
    request: InsightsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = get_file_for_user(db, current_user.id, request.file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    df = _load_user_dataframe(request.file_id, current_user.id, db)
    try:
        anomalies_res = MLService.detect_anomalies(df)
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
    except Exception:
        logger.exception("Unhandled error in %s", __name__)
        raise HTTPException(status_code=500, detail="Could not generate insights. Please check your inputs and try again.")
