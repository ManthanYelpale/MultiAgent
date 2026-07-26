import logging
import os
import re

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
import pandas as pd
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.crud.uploaded_file import get_file_for_user
from app.db.session import SessionLocal, get_db
from app.models.user import User
from app.schemas.report import (
    GenerateReportRequest,
    ReportResponse,
    WeeklyReportRequest,
)
from app.services.report import REPORTS_DIR, generate_weekly_report_pipeline
from app.services.report_builder import ReportBuilder
from app.services.storage import get_storage_service
from app.services.charts import ChartError, compute_chart_data
from app.models.dashboard import Dashboard
from app.services.ml import MLService, generate_ai_insights, generate_kpi_insight
from app.services.jobs import create_job, get_job, register_handler
from app.services.audit import record_audit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])


def _load_dataframe(owner_id: int, stored_filename: str, file_type: str) -> pd.DataFrame:
    # Uploads live under UPLOAD_DIR/<owner_id>/, so the path must go through the
    # storage service — joining UPLOAD_DIR directly skips the per-user directory.
    path = get_storage_service().get_file_path(owner_id, stored_filename)
    if not os.path.exists(path):
        raise ValueError("Uploaded file missing on disk")
    if file_type == "csv":
        return pd.read_csv(path)
    if file_type == "xlsx":
        return pd.read_excel(path)
    raise ValueError("Reports can only be generated from tabular files (CSV or Excel)")


def _download_url(filename: str | None) -> str | None:
    return f"{settings.API_V1_PREFIX}/reports/download/{filename}" if filename else None


# --------------------------------------------------------------------------
# Job handlers — run off the request thread via the jobs executor.
# --------------------------------------------------------------------------
def _run_weekly_report(params: dict) -> dict:
    user_id = params["user_id"]
    file_id = params["file_id"]
    db = SessionLocal()
    try:
        db_file = get_file_for_user(db, user_id, file_id)
        if not db_file:
            raise ValueError("File not found")
        df = _load_dataframe(user_id, db_file.stored_filename, db_file.file_type)
        report_data = generate_weekly_report_pipeline(
            db_file=db_file,
            df=df,
            target_column=params.get("target_column"),
            date_column=params.get("date_column"),
            export_format=params.get("export_format", "both"),
        )
        return {
            "file_id": db_file.id,
            "original_filename": db_file.original_filename,
            "insights_summary": report_data["insights_summary"],
            "pdf_filename": report_data["pdf_filename"],
            "pptx_filename": report_data["pptx_filename"],
            "pdf_download_url": _download_url(report_data["pdf_filename"]),
            "pptx_download_url": _download_url(report_data["pptx_filename"]),
        }
    finally:
        db.close()


def _run_custom_report(params: dict) -> dict:
    user_id = params["user_id"]
    file_id = params["file_id"]
    sections = params.get("sections", [])
    fmt = params.get("format", "both")
    db = SessionLocal()
    try:
        db_file = get_file_for_user(db, user_id, file_id)
        if not db_file:
            raise ValueError("File not found")
        df = _load_dataframe(user_id, db_file.stored_filename, db_file.file_type)
        dashboard = db.query(Dashboard).filter(
            Dashboard.file_id == file_id, Dashboard.user_id == user_id
        ).first()

        kpis, charts, insights_text, forecast_data = [], [], None, None

        if dashboard:
            for c in dashboard.charts:
                try:
                    data_res = compute_chart_data(
                        db=db, user_id=user_id, file_id=file_id,
                        chart_type=c.chart_type, x_column=c.x_column or "",
                        y_column=c.y_column, agg_function=c.agg_function,
                    )
                except ChartError:
                    continue  # one bad chart shouldn't abort the report
                if c.chart_type == "kpi":
                    val = data_res.get("data", {}).get("value", 0)
                    insight = (generate_kpi_insight(c.y_column, str(val), c.agg_function,
                                                    db_file.original_filename)
                               if "insights" in sections else None)
                    kpis.append({"title": f"{c.agg_function.capitalize()} of {c.y_column}",
                                 "value": val, "insight": insight})
                else:
                    charts.append({"chart_type": c.chart_type, "x_column": c.x_column,
                                   "y_column": c.y_column, "agg_function": c.agg_function,
                                   "data": data_res.get("data", []), "insight": None})

        if "insights" in sections:
            anomalies_res = MLService.detect_anomalies(df)
            fc_res = None
            if "forecast" in sections:
                num_cols = df.select_dtypes(include=["number"]).columns
                if len(num_cols) > 0:
                    fc_res = MLService.forecast(df, target_column=num_cols[0], horizon=5)
                    forecast_data = fc_res
            insights_text = generate_ai_insights(
                filename=db_file.original_filename, df=df,
                anomalies_info=anomalies_res, forecast_info=fc_res,
            )

        builder = ReportBuilder(db_file.original_filename, sections)
        pdf_filename = pptx_filename = None
        if fmt in ("pdf", "both"):
            pdf_filename = f"report_{db_file.id}_{builder.report_id}.pdf"
            builder.build_pdf(pdf_filename, kpis=kpis, insights_text=insights_text,
                              charts=charts, forecast_data=forecast_data)
        if fmt in ("pptx", "both"):
            pptx_filename = f"presentation_{db_file.id}_{builder.report_id}.pptx"
            builder.build_pptx(pptx_filename, kpis=kpis, insights_text=insights_text,
                               charts=charts, forecast_data=forecast_data)

        return {
            "file_id": db_file.id,
            "original_filename": db_file.original_filename,
            "insights_summary": insights_text or "",
            "pdf_filename": pdf_filename,
            "pptx_filename": pptx_filename,
            "pdf_download_url": _download_url(pdf_filename),
            "pptx_download_url": _download_url(pptx_filename),
        }
    finally:
        db.close()


register_handler("report_weekly", _run_weekly_report)
register_handler("report_custom", _run_custom_report)


# --------------------------------------------------------------------------
# Endpoints — enqueue and poll. Heavy work no longer blocks the request thread.
# --------------------------------------------------------------------------
@router.post("/weekly", status_code=status.HTTP_202_ACCEPTED)
def generate_weekly_report(
    request: WeeklyReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not get_file_for_user(db, current_user.id, request.file_id):
        raise HTTPException(status_code=404, detail="File not found")
    job_id = create_job(current_user.id, "report_weekly", {
        "user_id": current_user.id, "file_id": request.file_id,
        "target_column": request.target_column, "date_column": request.date_column,
        "export_format": request.export_format,
    })
    record_audit(db, "report.request", user_id=current_user.id, target=str(request.file_id))
    return {"job_id": job_id, "status": "pending"}


@router.post("/generate", status_code=status.HTTP_202_ACCEPTED)
def generate_custom_report(
    request: GenerateReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not get_file_for_user(db, current_user.id, request.file_id):
        raise HTTPException(status_code=404, detail="File not found")
    job_id = create_job(current_user.id, "report_custom", {
        "user_id": current_user.id, "file_id": request.file_id,
        "sections": request.sections, "format": request.format,
    })
    record_audit(db, "report.request", user_id=current_user.id, target=str(request.file_id))
    return {"job_id": job_id, "status": "pending"}


@router.get("/jobs/{job_id}")
def get_report_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poll a report job. Returns status and, once succeeded, the download URLs."""
    job = get_job(db, current_user.id, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job.id,
        "status": job.status,
        "result": job.result if job.status == "succeeded" else None,
        "error": job.error if job.status == "failed" else None,
    }


# report_<file_id>_<report_id>.pdf / presentation_<file_id>_<report_id>.pptx
_REPORT_NAME_RE = re.compile(r"^(?:report|presentation)_(\d+)_[0-9a-f]{8}\.(pdf|pptx)$")

_MEDIA_TYPES = {
    "pdf": "application/pdf",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}


@router.get("/download/{filename}")
def download_report(
    filename: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # The path parameter is untrusted. Starlette's path converter is [^/]+, which on
    # Windows still admits backslashes, so "..\..\.env" reached the filesystem and
    # served arbitrary files. Match a strict allowlist pattern first, then verify the
    # resolved path is genuinely inside REPORTS_DIR before touching it.
    match = _REPORT_NAME_RE.match(filename)
    if not match:
        raise HTTPException(status_code=404, detail="Report file not found")

    file_id, extension = int(match.group(1)), match.group(2)

    # Authentication alone is not authorisation: confirm the requester owns the
    # dataset this report was generated from.
    if not get_file_for_user(db, current_user.id, file_id):
        raise HTTPException(status_code=404, detail="Report file not found")

    reports_root = os.path.realpath(REPORTS_DIR)
    file_path = os.path.realpath(os.path.join(reports_root, filename))
    if os.path.commonpath([reports_root, file_path]) != reports_root:
        raise HTTPException(status_code=404, detail="Report file not found")

    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Report file not found")

    return FileResponse(path=file_path, filename=filename, media_type=_MEDIA_TYPES[extension])
