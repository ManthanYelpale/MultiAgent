import logging

from sqlalchemy import create_engine, pool
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.base import Base

logger = logging.getLogger(__name__)

is_sqlite = settings.DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args=connect_args,
    # An in-memory SQLite DB (used by the test suite) must share one connection or each
    # session sees an empty database.
    poolclass=pool.StaticPool if settings.DATABASE_URL.endswith(":memory:") else None,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Create tables from the ORM metadata.

    Previously this ran as an import-time side effect and imported only two of the model
    modules, so which tables existed depended on import order and fought with Alembic.
    It is now explicit and imports the full model registry. In production, Alembic is the
    single source of truth and this is a no-op unless AUTO_CREATE_TABLES is set.
    """
    if settings.is_production and not settings.AUTO_CREATE_TABLES:
        logger.info("Production mode: skipping create_all; Alembic owns the schema.")
        return
    import app.models  # noqa: F401  — registers every model on Base.metadata
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ensured via create_all (development mode).")


def get_db():
    """FastAPI dependency that yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
