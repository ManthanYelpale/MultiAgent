import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.crud.uploaded_file import get_file_for_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.rag import IndexFileResponse, RAGQueryRequest, RAGQueryResponse
from app.services.rag import rag_service
from app.services.storage import get_storage_service

router = APIRouter(prefix="/rag", tags=["rag"])


@router.post("/index/{file_id}", response_model=IndexFileResponse)
def index_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_file = get_file_for_user(db, current_user.id, file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    if db_file.file_type != "pdf":
        raise HTTPException(status_code=400, detail="Only PDF files can be indexed for RAG")

    # Uploads live under UPLOAD_DIR/<owner_id>/, so the path must go through the
    # storage service — joining UPLOAD_DIR directly skips the per-user directory.
    storage = get_storage_service()
    file_path = storage.get_file_path(current_user.id, db_file.stored_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Physical PDF file missing on disk")

    try:
        chunks_count = rag_service.index_pdf_file(
            filepath=file_path,
            filename=db_file.original_filename,
            file_id=db_file.id,
            owner_id=current_user.id,
        )
        return IndexFileResponse(
            file_id=db_file.id,
            filename=db_file.original_filename,
            chunks_indexed=chunks_count,
            status="success",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to index PDF: {exc}") from exc


@router.post("/query", response_model=RAGQueryResponse)
def query_rag(
    request: RAGQueryRequest,
    current_user: User = Depends(get_current_user),
):
    result = rag_service.query_rag(
        owner_id=current_user.id,
        question=request.question,
        file_ids=request.file_ids,
        top_k=request.top_k,
    )
    return RAGQueryResponse(**result)
