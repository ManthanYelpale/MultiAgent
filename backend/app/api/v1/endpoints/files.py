import json
import os
import uuid
import pandas as pd
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.crud.uploaded_file import create_uploaded_file, get_file_for_user, list_files_for_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.uploaded_file import UploadedFileOut
from app.services.storage import get_storage_service
from app.services.profiler import run_profiler

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
    contents = await file.read()
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.MAX_UPLOAD_MB}MB limit")
        
    stored_path = storage.save_file(current_user.id, stored_filename, contents)

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

@router.get("/{file_id}/data", response_model=list[dict[str, Any]])
def get_file_data(
    file_id: int,
    page: int = 1,
    limit: int = 25,
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

    try:
        if db_file.file_type == "csv":
            df = pd.read_csv(path)
        else:
            df = pd.read_excel(path)

        start = (page - 1) * limit
        end = start + limit
        
        preview = df.iloc[start:end].fillna("").to_dict(orient="records")
        return preview
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file data: {str(e)}")
