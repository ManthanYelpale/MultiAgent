from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.ratelimit import login_limiter, rate_limit, signup_limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.crud.user import (
    authenticate_user,
    bump_token_version,
    create_user,
    get_user_by_email,
    set_password,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.token import Token
from app.schemas.user import (
    PasswordChange,
    PasswordResetConfirm,
    PasswordResetRequest,
    UserCreate,
    UserOut,
)
from app.services.audit import record_audit
from app.services.password_reset import (
    deliver_reset_token,
    issue_reset_token,
    redeem_reset_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.post(
    "/signup",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(signup_limiter, "signup"))],
)
def signup(user_in: UserCreate, request: Request, db: Session = Depends(get_db)):
    existing = get_user_by_email(db, user_in.email.lower().strip())
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = create_user(db, user_in)
    record_audit(db, "user.signup", user_id=user.id, ip_address=_client_ip(request))
    return user


@router.post(
    "/login",
    response_model=Token,
    dependencies=[Depends(rate_limit(login_limiter, "login"))],
)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        record_audit(db, "user.login_failed", target=form_data.username[:255],
                     ip_address=_client_ip(request))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    login_limiter.reset(f"login:{_client_ip(request) or 'unknown'}")
    record_audit(db, "user.login", user_id=user.id, ip_address=_client_ip(request))
    access_token = create_access_token(subject=str(user.id), token_version=user.token_version)
    return Token(access_token=access_token)


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_everywhere(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Invalidate every token issued for this account."""
    bump_token_version(db, current_user)
    record_audit(db, "user.logout_all", user_id=current_user.id, ip_address=_client_ip(request))


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: PasswordChange,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    set_password(db, current_user, payload.new_password)
    record_audit(db, "user.password_change", user_id=current_user.id, ip_address=_client_ip(request))


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(
    payload: PasswordResetRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Always returns 202, whether or not the email exists, to avoid user enumeration."""
    user = get_user_by_email(db, payload.email.lower().strip())
    if user:
        token = issue_reset_token(db, user)
        deliver_reset_token(user, token)
        record_audit(db, "user.password_reset_requested", user_id=user.id,
                     ip_address=_client_ip(request))
    return {"detail": "If that email exists, a reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(
    payload: PasswordResetConfirm,
    request: Request,
    db: Session = Depends(get_db),
):
    ok = redeem_reset_token(db, payload.token, hash_password(payload.new_password))
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    record_audit(db, "user.password_reset", ip_address=_client_ip(request))


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permanently delete the account and all associated data (GDPR erasure)."""
    import os
    import shutil

    from app.core.config import settings
    from app.models.chat import ChatHistory
    from app.models.cleaning import CleanedDataset, CleaningConfig, CleaningTemplate
    from app.models.dashboard import Dashboard
    from app.models.job import Job
    from app.models.password_reset import PasswordResetToken
    from app.models.uploaded_file import UploadedFile
    from app.services.rag import rag_service

    user_id = current_user.id
    file_ids = [f.id for f in db.query(UploadedFile.id).filter(UploadedFile.owner_id == user_id)]

    rag_service.purge_user(user_id)

    # Delete dependent rows explicitly so this works regardless of whether the DB
    # enforces ON DELETE CASCADE (SQLite in tests does not by default).
    if file_ids:
        db.query(CleanedDataset).filter(CleanedDataset.file_id.in_(file_ids)).delete(synchronize_session=False)
        db.query(CleaningConfig).filter(CleaningConfig.file_id.in_(file_ids)).delete(synchronize_session=False)
    db.query(ChatHistory).filter(ChatHistory.user_id == user_id).delete(synchronize_session=False)
    db.query(CleaningTemplate).filter(CleaningTemplate.user_id == user_id).delete(synchronize_session=False)
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user_id).delete(synchronize_session=False)
    db.query(Job).filter(Job.user_id == user_id).delete(synchronize_session=False)
    for dash in db.query(Dashboard).filter(Dashboard.user_id == user_id).all():
        db.delete(dash)  # cascades to charts via relationship
    db.query(UploadedFile).filter(UploadedFile.owner_id == user_id).delete(synchronize_session=False)

    # Audit row keeps the record with user_id set to NULL (FK is ON DELETE SET NULL).
    record_audit(db, "user.account_delete", user_id=user_id,
                 ip_address=_client_ip(request), commit=False)
    db.delete(current_user)
    db.commit()

    user_dir = os.path.join(settings.UPLOAD_DIR, str(user_id))
    if os.path.isdir(user_dir):
        shutil.rmtree(user_dir, ignore_errors=True)
