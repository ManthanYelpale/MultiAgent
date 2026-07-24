from typing import Any
from pydantic import BaseModel


class SQLGenerateRequest(BaseModel):
    question: str
    execute: bool = True


class SQLExecutionResult(BaseModel):
    columns: list[str]
    rows: list[dict[str, Any]]
    row_count: int


class SQLQueryResult(BaseModel):
    question: str
    generated_sql: str
    is_safe: bool
    execution_result: SQLExecutionResult | None = None
    error: str | None = None
