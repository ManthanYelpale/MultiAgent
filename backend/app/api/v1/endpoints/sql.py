from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.sql import SQLGenerateRequest, SQLQueryResult
from app.services.sql import generate_and_execute_sql

router = APIRouter(prefix="/sql", tags=["sql"])


@router.post("/query", response_model=SQLQueryResult)
def generate_and_run_sql(
    request: SQLGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = generate_and_execute_sql(db, request.question, execute=request.execute)
    return SQLQueryResult(**result)
