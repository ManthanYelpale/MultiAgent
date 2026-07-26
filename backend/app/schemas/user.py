from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# bcrypt silently ignores input past 72 bytes, so anything longer is a false sense of
# security. Reject it explicitly rather than truncating (which could also split a
# multi-byte UTF-8 character mid-sequence).
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_BYTES = 72


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=MIN_PASSWORD_LENGTH)
    full_name: str | None = Field(default=None, max_length=255)

    @field_validator("password")
    @classmethod
    def _validate_password(cls, value: str) -> str:
        # Length was previously enforced only in the browser, so any direct API call
        # could create an account with a one-character password.
        if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
            raise ValueError(
                f"Password must be at most {MAX_PASSWORD_BYTES} bytes "
                "(bcrypt ignores anything beyond that)."
            )
        if value.strip() != value:
            raise ValueError("Password must not begin or end with whitespace.")
        return value


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str | None
    is_active: bool
    created_at: datetime
