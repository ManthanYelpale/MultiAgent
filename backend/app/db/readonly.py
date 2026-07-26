"""Dedicated connection for the natural-language SQL agent.

Kept separate from app.db.session on purpose: the agent executes LLM-generated text,
so it must never share a connection with the privileged application role. If
READONLY_DATABASE_URL is unset the agent is disabled outright — falling back to the
main connection would silently reinstate the vulnerability this module exists to close.
"""

import logging
from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

logger = logging.getLogger(__name__)

_engine = None
_SessionFactory = None

if settings.READONLY_DATABASE_URL:
    _engine = create_engine(
        settings.READONLY_DATABASE_URL,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        # Belt and braces: the role already has default_transaction_read_only=on.
        execution_options={"postgresql_readonly": True},
    )
    _SessionFactory = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
else:
    logger.warning(
        "READONLY_DATABASE_URL is not configured — the natural-language SQL agent is "
        "disabled. See scripts/create_readonly_role.sql to provision the role."
    )


def is_available() -> bool:
    return _SessionFactory is not None


@contextmanager
def readonly_session(user_id: int) -> Iterator[Session]:
    """Yield a read-only session scoped to one user.

    Sets the `app.current_user_id` GUC that the row-level security policies read.
    Without it the policies see NULL and return no rows, so the failure mode is an
    empty result rather than a cross-tenant leak.

    The transaction is always rolled back: nothing this session does should persist,
    and a rollback also clears the SET LOCAL so a pooled connection cannot leak the
    previous user's id into the next request.
    """
    if _SessionFactory is None:
        raise RuntimeError("Read-only database connection is not configured.")

    session = _SessionFactory()
    try:
        session.execute(text("SET TRANSACTION READ ONLY"))
        # Bound parameter, not string interpolation — user_id reaches SET via a value.
        session.execute(
            text("SELECT set_config('app.current_user_id', :uid, true)"),
            {"uid": str(int(user_id))},
        )
        yield session
    finally:
        session.rollback()
        session.close()
