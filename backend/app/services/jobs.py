"""Lightweight background job runner.

Report and presentation generation are slow (pandas + sklearn + matplotlib + PDF/PPTX
assembly + LLM calls). Running them inline held a request thread for the whole duration;
enough concurrent report requests starved the pool and stalled unrelated endpoints.

Jobs are enqueued to a bounded thread pool and their lifecycle is persisted in the
`jobs` table so the client can poll for completion. This is deliberately dependency-free
(no Redis/Celery) to keep the project self-hostable for free. For a multi-process
deployment, swap this executor for a shared broker; the table-based status contract stays
the same.
"""

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable

from app.db.session import SessionLocal
from app.models.job import Job

logger = logging.getLogger(__name__)

# Bounded so report generation cannot consume every core.
_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="job")

# Registry of job handlers keyed by job_type. A handler takes (params: dict) and returns
# a JSON-serialisable result dict.
_HANDLERS: dict[str, Callable[[dict[str, Any]], dict[str, Any]]] = {}


def register_handler(job_type: str, handler: Callable[[dict[str, Any]], dict[str, Any]]) -> None:
    _HANDLERS[job_type] = handler


def create_job(user_id: int, job_type: str, params: dict[str, Any]) -> int:
    """Persist a pending job and schedule it. Returns the job id."""
    db = SessionLocal()
    try:
        job = Job(user_id=user_id, job_type=job_type, status="pending", params=params)
        db.add(job)
        db.commit()
        db.refresh(job)
        job_id = job.id
    finally:
        db.close()

    _executor.submit(_run_job, job_id)
    return job_id


def _run_job(job_id: int) -> None:
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job is None:
            return
        handler = _HANDLERS.get(job.job_type)
        if handler is None:
            job.status = "failed"
            job.error = f"No handler registered for job type '{job.job_type}'"
            db.commit()
            return

        job.status = "running"
        db.commit()
        params = job.params or {}
    finally:
        db.close()

    # Run the handler outside the DB session so a long job doesn't hold a connection.
    result: dict[str, Any] | None = None
    error: str | None = None
    try:
        result = handler(params)
    except Exception as exc:
        logger.exception("Job %s failed", job_id)
        error = str(exc)

    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if job is None:
            return
        if error is None:
            job.status = "succeeded"
            job.result = result
        else:
            job.status = "failed"
            # Generic message to the client; full detail is in the logs.
            job.error = "Job failed during processing."
        db.commit()
    finally:
        db.close()


def get_job(db, user_id: int, job_id: int) -> Job | None:
    return db.query(Job).filter(Job.id == job_id, Job.user_id == user_id).first()
