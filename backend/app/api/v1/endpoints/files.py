import logging
import json
import os
import uuid
import pandas as pd
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.crud.uploaded_file import create_uploaded_file, get_file_for_user, list_files_for_user
from app.db.session import get_db
from app.models.user import User
from app.models.uploaded_file import UploadedFile
from app.models.cleaning import CleanedDataset, CleaningConfig
from app.models.chat import ChatHistory
from app.models.dashboard import Dashboard, Chart
from app.schemas.uploaded_file import UploadedFileOut
from app.services.storage import get_storage_service
from app.services.profile import run_profiler
from app.services.rag import rag_service
from app.services.audit import record_audit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/files", tags=["files"])

ALLOWED_EXTENSIONS = {".csv": "csv", ".xlsx": "xlsx", ".xls": "xlsx", ".pdf": "pdf"}



@router.post("/upload", response_model=UploadedFileOut, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {list(ALLOWED_EXTENSIONS)}",
        )
    file_type = ALLOWED_EXTENSIONS[ext]

    stored_filename = f"{uuid.uuid4().hex}{ext}"

    storage = get_storage_service()
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024

    # Read in chunks and abort as soon as the limit is exceeded, rather than buffering
    # the whole upload into memory first (a 2GB POST used to be fully resident before
    # the size check rejected it).
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(status_code=413, detail=f"File exceeds {settings.MAX_UPLOAD_MB}MB limit")
        chunks.append(chunk)

    stored_path = storage.save_file(current_user.id, stored_filename, b"".join(chunks))

    row_count, column_count, columns_preview = run_profiler(stored_path, file_type)

    return create_uploaded_file(
        db=db,
        owner_id=current_user.id,
        original_filename=file.filename,
        stored_filename=stored_filename,
        file_type=file_type,
        row_count=row_count,
        column_count=column_count,
        columns_preview=columns_preview,
    )


@router.get("", response_model=list[UploadedFileOut])
def list_my_files(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_files_for_user(db, current_user.id)


@router.get("/{file_id}", response_model=UploadedFileOut)
def get_my_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = get_file_for_user(db, current_user.id, file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    return db_file

@router.get("/{file_id}/data")
def get_file_data(
    file_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = get_file_for_user(db, current_user.id, file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    if db_file.file_type not in ["csv", "xlsx"]:
        raise HTTPException(status_code=400, detail="Data preview is only supported for tabular files")

    storage = get_storage_service()
    path = storage.get_file_path(current_user.id, db_file.stored_filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    start = (page - 1) * limit
    try:
        if db_file.file_type == "csv":
            # Read only the requested window instead of re-parsing the whole file on
            # every page. Header is row 0; skip the rows before the window.
            header = pd.read_csv(path, nrows=0)
            skip = range(1, start + 1) if start > 0 else None
            df = pd.read_csv(path, skiprows=skip, nrows=limit, header=0,
                             names=list(header.columns))
            has_more = len(df) == limit and _csv_has_more(path, start + limit)
        else:
            full = pd.read_excel(path)
            df = full.iloc[start:start + limit]
            has_more = start + limit < len(full)

        rows = df.fillna("").to_dict(orient="records")
    except Exception:
        logger.exception("Unhandled error reading file data")
        raise HTTPException(status_code=500, detail="Could not read file data.")

    # Expose whether another page exists, so the client's "Next" button is accurate
    # instead of guessing from whether the page was full.
    return {"rows": rows, "page": page, "limit": limit, "has_more": has_more}


def _csv_has_more(path: str, after_row: int) -> bool:
    """Cheap check for a row beyond `after_row` without parsing the whole file."""
    try:
        probe = pd.read_csv(path, skiprows=range(1, after_row + 1), nrows=1, header=0)
        return len(probe) > 0
    except Exception:
        return False


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a file, its cleaned versions, its DB rows, and its RAG chunks."""
    db_file = get_file_for_user(db, current_user.id, file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    storage = get_storage_service()

    # Remove the raw file and any cleaned outputs on disk.
    storage.delete_file(current_user.id, db_file.stored_filename)
    for cleaned in db.query(CleanedDataset).filter(CleanedDataset.file_id == file_id).all():
        if cleaned.storage_path:
            storage.delete_file(current_user.id, cleaned.storage_path)

    # Delete dependent rows in strict foreign-key order with immediate bulk deletes.
    # An ORM db.delete(parent) relies on the unit-of-work knowing the dependency, but
    # there is no ORM relationship from UploadedFile to Dashboard, so the flush could
    # delete the file before its dashboards and violate the FK on Postgres.
    dashboard_ids = [
        d_id for (d_id,) in db.query(Dashboard.id).filter(Dashboard.file_id == file_id)
    ]
    if dashboard_ids:
        db.query(Chart).filter(Chart.dashboard_id.in_(dashboard_ids)).delete(synchronize_session=False)
        db.query(Dashboard).filter(Dashboard.id.in_(dashboard_ids)).delete(synchronize_session=False)
    db.query(CleanedDataset).filter(CleanedDataset.file_id == file_id).delete(synchronize_session=False)
    db.query(CleaningConfig).filter(CleaningConfig.file_id == file_id).delete(synchronize_session=False)
    db.query(ChatHistory).filter(ChatHistory.file_id == file_id).update(
        {"file_id": None}, synchronize_session=False
    )
    db.query(UploadedFile).filter(UploadedFile.id == file_id).delete(synchronize_session=False)
    db.commit()

    rag_service.purge_file(current_user.id, file_id)
    record_audit(db, "file.delete", user_id=current_user.id, target=str(file_id))
