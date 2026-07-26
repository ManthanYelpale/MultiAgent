from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.crud.user import get_user_by_id
from app.db.session import get_db
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    claims = decode_access_token(token)
    if claims is None:
        raise credentials_exception

    user = get_user_by_id(db, int(claims["sub"]))
    if user is None:
        raise credentials_exception

    # Revocation: a token issued before the user's version was bumped (logout-everywhere,
    # password change) is rejected even though its signature and expiry are still valid.
    if claims.get("ver", 0) != user.token_version:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """RBAC dependency for admin-only endpoints."""
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
