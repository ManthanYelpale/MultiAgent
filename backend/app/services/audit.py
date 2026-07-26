"""Audit logging helper."""

import logging
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit import AuditLog

logger = logging.getLogger(__name__)


def record_audit(
    db: Session,
    action: str,
    user_id: int | None = None,
    target: str | None = None,
    ip_address: str | None = None,
    details: dict[str, Any] | None = None,
    commit: bool = True,
) -> None:
    """Write an audit row. Never let auditing failure break the primary operation."""
    try:
        db.add(AuditLog(
            user_id=user_id, action=action, target=target,
            ip_address=ip_address, details=details,
        ))
        if commit:
            db.commit()
    except Exception:
        logger.exception("Failed to write audit log for action=%s", action)
        db.rollback()
