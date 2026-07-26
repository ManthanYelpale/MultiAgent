import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings

# Only the algorithm we issue with is accepted on decode. Passing a list derived from
# configuration would let a misconfiguration re-open algorithm-confusion attacks.
_ACCEPTED_ALGORITHMS = ["HS256"]


def hash_password(password: str) -> str:
    """Hash password using bcrypt directly, truncating to 72 bytes."""
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against bcrypt hashed password string."""
    pwd_bytes = plain_password.encode("utf-8")[:72]
    try:
        return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(
    subject: str, token_version: int = 0, expires_minutes: int | None = None
) -> str:
    """
    subject is typically the user id (as a string). Returned token
    is a signed JWT to be sent back to the client as a Bearer token.

    token_version is embedded so tokens can be revoked en masse (logout-everywhere,
    password change) by bumping the user's stored version.
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "sub": subject,
        "ver": token_version,
        "exp": expire,
        "iat": now,
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")


def decode_access_token(token: str) -> dict | None:
    """
    Returns the decoded claims if the token is valid, else None.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=_ACCEPTED_ALGORITHMS,
            options={"require": ["exp", "sub"]},
        )
    except jwt.PyJWTError:
        return None

    subject = payload.get("sub")
    # The subject is used as an integer primary key downstream. Rejecting a non-numeric
    # value here turns a would-be 500 (ValueError on int()) into a clean 401.
    if not isinstance(subject, str) or not subject.isdigit():
        return None
    return payload
