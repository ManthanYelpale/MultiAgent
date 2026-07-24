from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.crud.uploaded_file import get_file_for_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.chat import ChatRequest, ChatResponse, DataQARequest
from app.services.llm import llm

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/message", response_model=ChatResponse)
def chat_message(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
    reply = llm.chat_completion(
        messages=messages,
        temperature=request.temperature,
        max_tokens=request.max_tokens,
    )
    return ChatResponse(reply=reply, model=settings.GROQ_MODEL)


@router.post("/data-qa", response_model=ChatResponse)
def data_qa(
    request: DataQARequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    context = ""
    if request.file_id:
        db_file = get_file_for_user(db, current_user.id, request.file_id)
        if db_file:
            context += f"File Name: {db_file.original_filename}\nColumns/Preview: {db_file.columns_preview}\nRow Count: {db_file.row_count}\n"

    if request.data_preview:
        context += f"Data Sample/Preview:\n{request.data_preview}\n"

    system_prompt = (
        "You are an expert AI data analyst. Answer the user's question accurately using the data schema "
        "and sample previews provided.\n\n"
        f"Data Context:\n{context if context else 'No file preview context provided.'}"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": request.question},
    ]

    reply = llm.chat_completion(messages=messages, temperature=0.3, max_tokens=1024)
    return ChatResponse(reply=reply, model=settings.GROQ_MODEL)
