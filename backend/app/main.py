import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.logging_config import configure_logging, request_id_ctx
from app.db.session import init_db
from app.services.maintenance import start_background_maintenance

configure_logging(settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.PROJECT_NAME)


@app.on_event("startup")
def _on_startup() -> None:
    init_db()
    start_background_maintenance()

# Explicit dev origins plus anything configured. Kept as a set to avoid duplicates.
origins = sorted({
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    *settings.cors_origins_list,
})

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    """Attach a correlation id to every request and log its outcome and latency."""
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
    token = request_id_ctx.set(request_id)
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        # A handler that raised past FastAPI's own handling. Log with the id, return a
        # generic body — never the traceback.
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.exception(
            "Unhandled exception",
            extra={"extra_fields": {"method": request.method, "path": request.url.path,
                                    "duration_ms": round(elapsed_ms, 1)}},
        )
        response = JSONResponse(status_code=500, content={"detail": "Internal server error"})
        response.headers["X-Request-ID"] = request_id
        request_id_ctx.reset(token)
        return response

    elapsed_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "request",
        extra={"extra_fields": {
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": round(elapsed_ms, 1),
        }},
    )
    response.headers["X-Request-ID"] = request_id
    request_id_ctx.reset(token)
    return response


app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def root():
    return {"message": f"{settings.PROJECT_NAME} API is running"}
