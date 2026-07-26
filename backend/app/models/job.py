from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.sql import func

from app.db.base import Base


class Job(Base):
    """Async work item (e.g. report generation) processed off the request thread.

    Lets slow CPU/IO-bound work return immediately with a job id the client polls,
    instead of holding a request thread for the full duration.
    """

    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    job_type = Column(String(50), nullable=False)          # e.g. "report"
    status = Column(String(20), nullable=False, default="pending", index=True)  # pending|running|succeeded|failed
    params = Column(JSON, nullable=True)
    result = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
