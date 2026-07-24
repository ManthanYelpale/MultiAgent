from fastapi import APIRouter
from app.api.v1.endpoints import (
    health, auth, files, analytics, chat, rag, reports, sql, dashboards, ai, cleaning
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(files.router)
api_router.include_router(reports.router)
api_router.include_router(sql.router)
api_router.include_router(ai.router)
api_router.include_router(cleaning.router)
api_router.include_router(dashboards.router)
api_router.include_router(rag.router)
api_router.include_router(analytics.router)
api_router.include_router(chat.router)
