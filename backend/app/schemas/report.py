from typing import Literal
from pydantic import BaseModel, Field


class WeeklyReportRequest(BaseModel):
    file_id: int
    target_column: str | None = None
    date_column: str | None = None
    export_format: Literal["pdf", "pptx", "both"] = Field(default="both")


class ReportResponse(BaseModel):
    file_id: int
    original_filename: str
    insights_summary: str
    pdf_filename: str | None = None
    pptx_filename: str | None = None
    pdf_download_url: str | None = None
    pptx_download_url: str | None = None
