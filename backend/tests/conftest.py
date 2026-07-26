"""Shared pytest fixtures.

The whole suite runs against an isolated in-memory SQLite database and a temporary upload
directory, so it never touches Postgres, a real Groq key, or the developer's files. The
SQL agent stays disabled (no READONLY_DATABASE_URL), which is the correct default.
"""

import os
import tempfile

# Configure the environment BEFORE importing app modules (settings read env at import).
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-thirty-two-chars-long!!")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("GROQ_API_KEY", "")

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.db.session import Base, engine, init_db
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def _prepare_database():
    # Point uploads at a temp dir so tests never write into the repo.
    tmp = tempfile.mkdtemp(prefix="test_uploads_")
    settings.UPLOAD_DIR = tmp
    init_db()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def _reset_rate_limiters():
    """The rate limiter is process-global; clear it between tests so one test's requests
    don't exhaust another's budget. (The limiter itself is exercised by its own test.)"""
    from app.core.ratelimit import login_limiter, signup_limiter, llm_limiter
    for limiter in (login_limiter, signup_limiter, llm_limiter):
        limiter._hits.clear()
    yield


@pytest.fixture
def client():
    return TestClient(app)


def _register_and_login(client, email, password="Str0ngPassw0rd!"):
    client.post("/api/v1/auth/signup", json={"email": email, "password": password, "full_name": "T"})
    resp = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    return resp.json()["access_token"]


@pytest.fixture
def auth_headers(client):
    import uuid
    token = _register_and_login(client, f"user_{uuid.uuid4().hex[:8]}@example.com")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def second_user_headers(client):
    import uuid
    token = _register_and_login(client, f"other_{uuid.uuid4().hex[:8]}@example.com")
    return {"Authorization": f"Bearer {token}"}
