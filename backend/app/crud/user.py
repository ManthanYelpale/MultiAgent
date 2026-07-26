from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.user import UserCreate


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, user_in: UserCreate) -> User:
    # Normalise email so lookups are case-insensitive and duplicates can't slip in via
    # capitalisation.
    user = User(
        email=user_in.email.lower().strip(),
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email.lower().strip())
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def set_password(db: Session, user: User, new_password: str) -> None:
    """Change a password and invalidate all existing tokens for the user."""
    user.hashed_password = hash_password(new_password)
    user.token_version += 1
    db.commit()


def bump_token_version(db: Session, user: User) -> None:
    """Invalidate every outstanding token for the user (logout everywhere)."""
    user.token_version += 1
    db.commit()
