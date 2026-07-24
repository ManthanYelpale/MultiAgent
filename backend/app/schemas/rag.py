from pydantic import BaseModel


class CitationSource(BaseModel):
    file_id: int
    filename: str
    page_number: int
    score: float
    snippet: str


class IndexFileResponse(BaseModel):
    file_id: int
    filename: str
    chunks_indexed: int
    status: str


class RAGQueryRequest(BaseModel):
    question: str
    file_ids: list[int] | None = None  # None means search all user's indexed files
    top_k: int = 3


class RAGQueryResponse(BaseModel):
    question: str
    answer: str
    sources: list[CitationSource]
