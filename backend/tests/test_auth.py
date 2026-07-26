"""Auth, password policy, rate limiting, revocation, account lifecycle."""

import uuid


def _email():
    return f"u_{uuid.uuid4().hex[:8]}@example.com"


def test_signup_and_login_flow(client):
    email = _email()
    r = client.post("/api/v1/auth/signup", json={"email": email, "password": "Str0ngPassw0rd!"})
    assert r.status_code == 201
    r = client.post("/api/v1/auth/login", data={"username": email, "password": "Str0ngPassw0rd!"})
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_password_min_length_enforced_server_side(client):
    r = client.post("/api/v1/auth/signup", json={"email": _email(), "password": "short"})
    assert r.status_code == 422  # rejected before it ever reaches the DB


def test_duplicate_email_rejected(client):
    email = _email()
    client.post("/api/v1/auth/signup", json={"email": email, "password": "Str0ngPassw0rd!"})
    r = client.post("/api/v1/auth/signup", json={"email": email, "password": "Str0ngPassw0rd!"})
    assert r.status_code == 400


def test_email_case_insensitive_login(client):
    email = _email()
    client.post("/api/v1/auth/signup", json={"email": email, "password": "Str0ngPassw0rd!"})
    r = client.post("/api/v1/auth/login", data={"username": email.upper(), "password": "Str0ngPassw0rd!"})
    assert r.status_code == 200


def test_wrong_password_rejected(client):
    email = _email()
    client.post("/api/v1/auth/signup", json={"email": email, "password": "Str0ngPassw0rd!"})
    r = client.post("/api/v1/auth/login", data={"username": email, "password": "wrong"})
    assert r.status_code == 401


def test_protected_route_requires_token(client):
    assert client.get("/api/v1/files").status_code == 401


def test_forged_token_rejected(client):
    import jwt
    forged = jwt.encode({"sub": "1", "exp": 9999999999}, "wrong-key", algorithm="HS256")
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {forged}"})
    assert r.status_code == 401


def test_logout_all_revokes_existing_token(client):
    email = _email()
    client.post("/api/v1/auth/signup", json={"email": email, "password": "Str0ngPassw0rd!"})
    token = client.post("/api/v1/auth/login",
                        data={"username": email, "password": "Str0ngPassw0rd!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    # Bump token version -> the old token must stop working.
    assert client.post("/api/v1/auth/logout-all", headers=headers).status_code == 204
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_change_password_requires_current(client):
    email = _email()
    client.post("/api/v1/auth/signup", json={"email": email, "password": "Str0ngPassw0rd!"})
    token = client.post("/api/v1/auth/login",
                        data={"username": email, "password": "Str0ngPassw0rd!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    r = client.post("/api/v1/auth/change-password", headers=headers,
                    json={"current_password": "wrong", "new_password": "An0therStr0ng!"})
    assert r.status_code == 400


def test_forgot_password_does_not_reveal_existence(client):
    # Unknown email still returns 202, so an attacker cannot enumerate accounts.
    r = client.post("/api/v1/auth/forgot-password", json={"email": "nobody@example.com"})
    assert r.status_code == 202


def test_account_deletion(client):
    email = _email()
    client.post("/api/v1/auth/signup", json={"email": email, "password": "Str0ngPassw0rd!"})
    token = client.post("/api/v1/auth/login",
                        data={"username": email, "password": "Str0ngPassw0rd!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.request("DELETE", "/api/v1/auth/me", headers=headers).status_code == 204
    # Token no longer resolves to a user.
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_login_rate_limited(client):
    email = _email()
    client.post("/api/v1/auth/signup", json={"email": email, "password": "Str0ngPassw0rd!"})
    codes = [client.post("/api/v1/auth/login",
                         data={"username": email, "password": "bad"}).status_code for _ in range(14)]
    assert 429 in codes
