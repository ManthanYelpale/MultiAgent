from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check():
    """Liveness: is the process up? Cheap, no dependencies."""
    return {"status": "ok"}


@router.get("/ready")
def readiness_check(response: Response, db: Session = Depends(get_db)):
    """Readiness: can the process actually serve traffic (DB reachable)?

    Returns 503 when a dependency is down, so an orchestrator stops routing to it —
    the previous /health returned ok even with the database unreachable.
    """
    checks = {}
    healthy = True
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "unavailable"
        healthy = False

    if not healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "ok" if healthy else "degraded", "checks": checks}
