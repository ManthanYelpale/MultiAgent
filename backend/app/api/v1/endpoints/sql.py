from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.ratelimit import llm_limiter, rate_limit
from app.models.user import User
from app.schemas.sql import SQLGenerateRequest, SQLQueryResult
from app.services.sql import generate_and_execute_sql

router = APIRouter(prefix="/sql", tags=["sql"])


@router.post(
    "/query",
    response_model=SQLQueryResult,
    dependencies=[Depends(rate_limit(llm_limiter, "sql_query"))],
)
def generate_and_run_sql(
    request: SQLGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    # No get_db dependency: the agent opens its own restricted connection so that
    # LLM-generated SQL can never touch the privileged application session.
    result = generate_and_execute_sql(
        user_id=current_user.id,
        question=request.question,
        execute=request.execute,
    )
    return SQLQueryResult(**result)
