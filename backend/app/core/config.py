import secrets
import warnings

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# The value shipped in .env.example. Anyone with repo access knows it, so a deployment
# still using it has no authentication at all — tokens can be forged for any user id.
PLACEHOLDER_SECRET_KEY = "change-this-to-a-long-random-string"
MIN_SECRET_KEY_LENGTH = 32


class Settings(BaseSettings):
    """
    Central app configuration. Values are loaded from environment
    variables / a .env file. See .env.example for the full list.
    """

    PROJECT_NAME: str = "AI Business OS"
    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/ai_business_os"

    # Connection used ONLY by the natural-language SQL agent. Must point at the
    # `ai_readonly` role created by scripts/create_readonly_role.sql — a non-superuser
    # with no access to the users table and row-level security enforcing tenant
    # isolation. When empty the SQL agent is disabled rather than silently falling
    # back to the privileged DATABASE_URL.
    READONLY_DATABASE_URL: str = ""

    SECRET_KEY: str = "change-this-to-a-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_MB: int = 25

    CORS_ORIGINS: str = "http://localhost:5173"

    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    ENVIRONMENT: str = "development"
    # When true, create_all runs even in production. Off by default so Alembic owns the
    # schema; useful for a first boot or ephemeral environments.
    AUTO_CREATE_TABLES: bool = False
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() in {"production", "prod"}

    @model_validator(mode="after")
    def _reject_insecure_secret_key(self) -> "Settings":
        """Refuse to run with a guessable signing key.

        Hard-fails in production; loud warning in development so local setup still works.
        """
        weak = (
            self.SECRET_KEY == PLACEHOLDER_SECRET_KEY
            or len(self.SECRET_KEY) < MIN_SECRET_KEY_LENGTH
        )
        if not weak:
            return self

        message = (
            "SECRET_KEY is unset, too short, or still the .env.example placeholder. "
            "Anyone who has seen the repository can forge a JWT for any user. "
            f"Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\"\n"
            f"Suggested value: {secrets.token_urlsafe(48)}"
        )
        if self.is_production:
            raise ValueError(message)
        warnings.warn(f"INSECURE SECRET_KEY — {message}", stacklevel=2)
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
