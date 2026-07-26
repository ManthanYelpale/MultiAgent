from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, JSON
from sqlalchemy.sql import func

from app.db.base import Base


class AuditLog(Base):
    """Append-only record of security-relevant actions.

    Answers "who did what, when" — logins, file deletes, account deletion, report
    exports. user_id is nullable so failed logins (no known user) can still be recorded.
    """

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(80), nullable=False, index=True)
    target = Column(String(255), nullable=True)
    ip_address = Column(String(64), nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
