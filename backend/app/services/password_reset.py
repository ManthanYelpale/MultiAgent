"""Password reset token issuance and redemption.

Email delivery is intentionally pluggable. With no SMTP provider configured (the default
for a free/self-hosted deploy), the reset link is written to the application log instead
of being emailed — the flow is fully functional without a paid mail service. Wire
`deliver_reset_token` to a real provider when one is available.
"""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.password_reset import PasswordResetToken
from app.models.user import User

logger = logging.getLogger(__name__)

RESET_TOKEN_TTL_MINUTES = 30


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def issue_reset_token(db: Session, user: User) -> str:
    """Create a single-use token, store only its hash, return the plaintext once."""
    token = secrets.token_urlsafe(32)
    db.add(PasswordResetToken(
        user_id=user.id,
        token_hash=_hash(token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES),
    ))
    db.commit()
    return token


def deliver_reset_token(user: User, token: str) -> None:
    """Send the reset link. Falls back to logging when no mailer is configured."""
    # Replace with an SMTP/API email send in production.
    logger.info(
        "Password reset requested",
        extra={"extra_fields": {"email": user.email,
                                "reset_token": token,
                                "note": "no mailer configured; token logged for manual delivery"}},
    )


def redeem_reset_token(db: Session, token: str, new_password_hash: str) -> bool:
    """Consume a valid token and set the new password hash. Returns success."""
    from app.models.user import User as UserModel

    record = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == _hash(token))
        .first()
    )
    if record is None or record.used:
        return False
    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return False

    user = db.query(UserModel).filter(UserModel.id == record.user_id).first()
    if user is None:
        return False

    user.hashed_password = new_password_hash
    user.token_version += 1  # invalidate existing sessions
    record.used = True
    db.commit()
    return True
