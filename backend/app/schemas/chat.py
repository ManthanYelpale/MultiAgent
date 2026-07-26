from typing import Any, Literal
from pydantic import BaseModel, Field

MAX_MESSAGES_PER_REQUEST = 40
MAX_MESSAGE_CHARS = 8000


class ChatMessage(BaseModel):
    # Previously a free-form str, which let callers inject their own "system" turns and
    # override the server's instructions. The system prompt is set server-side only.
    role: Literal["user", "assistant"] = Field(..., description="user or assistant")
    content: str = Field(..., min_length=1, max_length=MAX_MESSAGE_CHARS)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., min_length=1, max_length=MAX_MESSAGES_PER_REQUEST)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=1024, ge=1, le=4096)


class ChatResponse(BaseModel):
    reply: str
    model: str


class DataQARequest(BaseModel):
    question: str
    file_id: int | None = None
    data_preview: dict[str, Any] | None = None
