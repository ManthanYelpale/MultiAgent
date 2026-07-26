from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from app.api.deps import get_current_user
from app.core.ratelimit import llm_limiter, rate_limit
from app.db.session import get_db
from app.models.user import User
from app.models.chat import ChatHistory
from app.services.chat_bot import chat_orchestrator
from app.services.ml import generate_kpi_insight

router = APIRouter(prefix="/ai", tags=["ai"])

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)
    file_id: Optional[int] = None

class ChatResponse(BaseModel):
    reply: str
    intent: str

class InsightRequest(BaseModel):
    metric_name: str
    metric_value: str
    agg_function: str
    dataset_name: str

class InsightResponse(BaseModel):
    insight: str

@router.post(
    "/chat",
    response_model=ChatResponse,
    dependencies=[Depends(rate_limit(llm_limiter, "ai_chat"))],
)
def chat_with_data(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(ChatHistory).filter(ChatHistory.user_id == current_user.id)
    if request.file_id:
        query = query.filter(ChatHistory.file_id == request.file_id)
    history_records = query.order_by(ChatHistory.created_at.asc()).all()
    
    chat_history = [{"role": h.role, "content": h.content} for h in history_records]
    
    result = chat_orchestrator.process_message(
        db=db,
        user_id=current_user.id,
        file_id=request.file_id,
        message=request.message,
        chat_history=chat_history
    )
    
    return ChatResponse(reply=result["reply"], intent=result["intent"])


@router.post("/insights", response_model=InsightResponse)
def get_kpi_insight(
    request: InsightRequest,
    current_user: User = Depends(get_current_user),
):
    insight = generate_kpi_insight(
        request.metric_name, 
        request.metric_value, 
        request.agg_function, 
        request.dataset_name
    )
    return InsightResponse(insight=insight)

@router.get("/chat/history")
def get_chat_history(
    file_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(ChatHistory).filter(ChatHistory.user_id == current_user.id)
    if file_id:
        query = query.filter(ChatHistory.file_id == file_id)
    records = query.order_by(ChatHistory.created_at.asc()).all()
    return [{"id": r.id, "role": r.role, "content": r.content, "intent": r.intent_routed_to, "created_at": r.created_at} for r in records]
