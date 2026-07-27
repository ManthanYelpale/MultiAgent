"""File upload/preview/delete and the cleaning data-integrity fixes."""

import io

import numpy as np
import pandas as pd

from app.services.clean import apply_auto_safe, _fill_median
from app.services.ml import MLService


def _upload(client, headers, name, content):
    files = {"file": (name, io.BytesIO(content.encode()), "text/csv")}
    return client.post("/api/v1/files/upload", headers=headers, files=files)


def test_upload_and_paginated_preview(client, auth_headers):
    rows = "col\n" + "\n".join(str(i) for i in range(60))
    fid = _upload(client, auth_headers, "big.csv", rows).json()["id"]

    p1 = client.get(f"/api/v1/files/{fid}/data?page=1&limit=25", headers=auth_headers).json()
    assert len(p1["rows"]) == 25
    assert p1["has_more"] is True

    p3 = client.get(f"/api/v1/files/{fid}/data?page=3&limit=25", headers=auth_headers).json()
    assert p3["has_more"] is False  # 60 rows -> page 3 has 10 and no more


def test_oversize_upload_rejected(client, auth_headers, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 0)  # anything non-empty is too big
    r = _upload(client, auth_headers, "x.csv", "a,b\n1,2\n")
    assert r.status_code == 413


def test_delete_file_removes_it(client, auth_headers):
    fid = _upload(client, auth_headers, "d.csv", "a,b\n1,2\n").json()["id"]
    assert client.request("DELETE", f"/api/v1/files/{fid}", headers=auth_headers).status_code == 204
    assert client.get(f"/api/v1/files/{fid}", headers=auth_headers).status_code == 404


def test_delete_file_with_dashboard_and_charts(client, auth_headers):
    # Reproduces the production FK-violation: a file referenced by a dashboard (and its
    # charts) must still delete cleanly. With SQLite FK enforcement on, wrong ordering
    # fails here just as it did on Postgres.
    fid = _upload(client, auth_headers, "dash.csv", "region,sales\nUS,10\nEU,20\n").json()["id"]
    # Skip cleaning so the dashboard endpoint builds it, then fetch to auto-create charts.
    client.post(f"/api/v1/cleaning/file/{fid}/skip", headers=auth_headers)
    dash = client.get(f"/api/v1/dashboards/file/{fid}", headers=auth_headers)
    assert dash.status_code == 200
    assert client.request("DELETE", f"/api/v1/files/{fid}", headers=auth_headers).status_code == 204
    assert client.get(f"/api/v1/files/{fid}", headers=auth_headers).status_code == 404


def test_delete_account_with_data(client):
    # Account deletion must also cascade through dashboards/charts without FK errors.
    import uuid
    email = f"del_{uuid.uuid4().hex[:8]}@example.com"
    client.post("/api/v1/auth/signup", json={"email": email, "password": "Str0ngPassw0rd!"})
    token = client.post("/api/v1/auth/login",
                        data={"username": email, "password": "Str0ngPassw0rd!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    fid = _upload(client, headers, "acc.csv", "region,sales\nUS,10\nEU,20\n").json()["id"]
    client.post(f"/api/v1/cleaning/file/{fid}/skip", headers=headers)
    client.get(f"/api/v1/dashboards/file/{fid}", headers=headers)
    assert client.request("DELETE", "/api/v1/auth/me", headers=headers).status_code == 204


# --- data-integrity units (no HTTP) ---------------------------------------
def test_auto_safe_preserves_legitimate_values():
    df = pd.DataFrame({"ticker": ["A", "-", "NULL", "B"], "qty": [1, 2, 3, 4]})
    out = apply_auto_safe(df)
    assert out["ticker"].tolist()[1] == "-"          # hyphen is a real value
    assert pd.isna(out["ticker"].tolist()[2])        # "NULL" normalised to NaN


def test_auto_safe_does_not_stringify_numbers_or_none():
    df = pd.DataFrame({"mixed": [1, "a", 3.5, None]})
    out = apply_auto_safe(df)
    assert out["mixed"].tolist()[0] == 1             # stayed numeric
    assert out["mixed"].tolist()[3] is None or pd.isna(out["mixed"].tolist()[3])


def test_fill_median_produces_numeric_column():
    df = pd.DataFrame({"price": ["100", "200", None, "300"]})
    _fill_median(df, "price", {})
    assert pd.api.types.is_numeric_dtype(df["price"])


def test_anomaly_index_maps_to_real_outlier():
    df = pd.DataFrame({"v": [1.0, np.nan, 2.0, 3.0, 2.5, 2.2, 2.4, 900.0, 2.1, 2.3]})
    res = MLService.detect_anomalies(df, contamination=0.1)
    flagged = [a["row_index"] for a in res["anomalies"]]
    assert 7 in flagged  # index of the true outlier (900.0), not a shifted position
