import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
import pandas as pd
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.crud.uploaded_file import get_file_for_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.report import ReportResponse, WeeklyReportRequest
from app.services.report_service import REPORTS_DIR, generate_weekly_report_pipeline

router = APIRouter(prefix="/reports", tags=["reports"])


def _load_dataframe(stored_filename: str, file_type: str) -> pd.DataFrame:
    path = os.path.join(settings.UPLOAD_DIR, stored_filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Uploaded file missing on disk")

    if file_type == "csv":
        return pd.read_csv(path)
    elif file_type == "xlsx":
        return pd.read_excel(path)
    else:
        raise HTTPException(status_code=400, detail="Reports can only be generated from tabular files (CSV or Excel)")


@router.post("/weekly", response_model=ReportResponse)
def generate_weekly_report(
    request: WeeklyReportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = get_file_for_user(db, current_user.id, request.file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    df = _load_dataframe(db_file.stored_filename, db_file.file_type)

    try:
        report_data = generate_weekly_report_pipeline(
            db_file=db_file,
            df=df,
            target_column=request.target_column,
            date_column=request.date_column,
            export_format=request.export_format,
        )

        pdf_url = f"{settings.API_V1_PREFIX}/reports/download/{report_data['pdf_filename']}" if report_data['pdf_filename'] else None
        pptx_url = f"{settings.API_V1_PREFIX}/reports/download/{report_data['pptx_filename']}" if report_data['pptx_filename'] else None

        return ReportResponse(
            file_id=db_file.id,
            original_filename=db_file.original_filename,
            insights_summary=report_data["insights_summary"],
            pdf_filename=report_data["pdf_filename"],
            pptx_filename=report_data["pptx_filename"],
            pdf_download_url=pdf_url,
            pptx_download_url=pptx_url,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Report generation error: {exc}") from exc


@router.get("/download/{filename}")
def download_report(
    filename: str,
    current_user: User = Depends(get_current_user),
):
    file_path = os.path.join(REPORTS_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Report file not found")

    media_type = "application/pdf" if filename.endswith(".pdf") else "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    return FileResponse(path=file_path, filename=filename, media_type=media_type)
