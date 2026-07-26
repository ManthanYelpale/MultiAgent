"""Regression tests for the security fixes: SQL validator, report download, cross-tenant."""

import io

import pytest

from app.services.sql import validate_and_sanitize_sql


@pytest.mark.parametrize("query", [
    "SELECT email, hashed_password FROM users",
    "SELECT * FROM pg_read_file('/etc/passwd')",
    "SELECT 1; COPY users TO '/tmp/x.csv'",
    "SELECT * FROM users JOIN uploaded_files ON true",
    "DELETE FROM users",
    "DROP TABLE users",
])
def test_sql_validator_blocks_dangerous_queries(query):
    ok, _, err = validate_and_sanitize_sql(query)
    assert ok is False, f"validator should have blocked: {query}"
    assert err


@pytest.mark.parametrize("query", [
    "SELECT original_filename FROM uploaded_files",
    "SELECT count(*) FROM charts",
    "WITH t AS (SELECT id FROM dashboards) SELECT * FROM t",
])
def test_sql_validator_allows_safe_scoped_queries(query):
    ok, cleaned, err = validate_and_sanitize_sql(query)
    assert ok is True, err
    assert "LIMIT" in cleaned.upper()


def test_sql_limit_not_swallowed_by_comment():
    ok, cleaned, _ = validate_and_sanitize_sql("SELECT 1 FROM charts -- trailing")
    assert ok
    # LIMIT must be on its own line, not commented out.
    assert cleaned.strip().upper().endswith("LIMIT 100")


def test_report_download_rejects_traversal(client, auth_headers):
    for name in ["..%5C..%5C.env", "....//....//.env", "etc/passwd", "random.pdf"]:
        r = client.get(f"/api/v1/reports/download/{name}", headers=auth_headers)
        assert r.status_code in (404, 401), name


def _upload_csv(client, headers, content="a,b\n1,2\n3,4\n"):
    files = {"file": ("data.csv", io.BytesIO(content.encode()), "text/csv")}
    return client.post("/api/v1/files/upload", headers=headers, files=files)


def test_user_cannot_access_another_users_file(client, auth_headers, second_user_headers):
    r = _upload_csv(client, auth_headers)
    assert r.status_code == 201
    file_id = r.json()["id"]
    # Owner can read it...
    assert client.get(f"/api/v1/files/{file_id}", headers=auth_headers).status_code == 200
    # ...a different user cannot.
    assert client.get(f"/api/v1/files/{file_id}", headers=second_user_headers).status_code == 404


def test_cleaning_status_requires_ownership(client, auth_headers, second_user_headers):
    file_id = _upload_csv(client, auth_headers).json()["id"]
    # The other user must not be able to probe this file's cleaning status.
    r = client.get(f"/api/v1/cleaning/file/{file_id}/status", headers=second_user_headers)
    assert r.status_code == 404
