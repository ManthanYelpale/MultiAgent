from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UploadedFileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    original_filename: str
    file_type: str
    row_count: int | None
    column_count: int | None
    columns_preview: str | None
    uploaded_at: datetime
