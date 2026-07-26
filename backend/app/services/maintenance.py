"""Periodic background maintenance.

Runs in a daemon thread so it never blocks shutdown. Handles the housekeeping that
previously never happened: generated report/chart files accumulated on disk forever,
and expired password-reset tokens were never purged.

For a multi-process deployment this work should move to a single scheduled worker
(e.g. a cron container) so it doesn't run once per process; the guard here keeps it
harmless in the common single-process case.
"""

import logging
import os
import threading
import time
from datetime import datetime, timezone

from app.core.config import settings

logger = logging.getLogger(__name__)

REPORTS_DIR = os.path.join(settings.UPLOAD_DIR, "reports")
# Generated artifacts older than this are deleted.
REPORT_MAX_AGE_SECONDS = 24 * 3600
SWEEP_INTERVAL_SECONDS = 3600

_started = False
_lock = threading.Lock()


def _cleanup_reports() -> int:
    if not os.path.isdir(REPORTS_DIR):
        return 0
    removed = 0
    cutoff = time.time() - REPORT_MAX_AGE_SECONDS
    for name in os.listdir(REPORTS_DIR):
        path = os.path.join(REPORTS_DIR, name)
        try:
            if os.path.isfile(path) and os.path.getmtime(path) < cutoff:
                os.remove(path)
                removed += 1
        except OSError:
            logger.warning("Could not remove stale report file: %s", path)
    return removed


def _cleanup_expired_tokens() -> int:
    from app.db.session import SessionLocal
    from app.models.password_reset import PasswordResetToken

    db = SessionLocal()
    try:
        deleted = (
            db.query(PasswordResetToken)
            .filter(PasswordResetToken.expires_at < datetime.now(timezone.utc))
            .delete(synchronize_session=False)
        )
        db.commit()
        return deleted
    except Exception:
        logger.exception("Failed to purge expired reset tokens")
        db.rollback()
        return 0
    finally:
        db.close()


def _sweep_loop() -> None:
    while True:
        try:
            reports = _cleanup_reports()
            tokens = _cleanup_expired_tokens()
            if reports or tokens:
                logger.info(
                    "maintenance sweep",
                    extra={"extra_fields": {"reports_removed": reports, "tokens_purged": tokens}},
                )
        except Exception:
            logger.exception("Maintenance sweep failed")
        time.sleep(SWEEP_INTERVAL_SECONDS)


def start_background_maintenance() -> None:
    global _started
    with _lock:
        if _started:
            return
        _started = True
    thread = threading.Thread(target=_sweep_loop, name="maintenance", daemon=True)
    thread.start()
    logger.info("Background maintenance thread started.")
