"""Central configuration. All secrets come from environment variables."""
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "PLS Smart Study Assistant API"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:3000"]

    database_url: str
    supabase_url: str
    supabase_jwt_secret: str | None = None
    supabase_service_role_key: str | None = None  # server-only: storage + account deletion
    storage_bucket: str = "gallery"
    max_upload_mb: int = 10
    rate_limit_per_minute: int = 240

    @field_validator("database_url")
    @classmethod
    def _use_asyncpg(cls, v: str) -> str:
        """Accept the URL exactly as Supabase shows it and switch to the async driver."""
        for prefix in ("postgresql://", "postgres://"):
            if v.startswith(prefix):
                return "postgresql+asyncpg://" + v[len(prefix):]
        return v

    @property
    def jwt_issuer(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1"

    @property
    def jwks_url(self) -> str:
        return f"{self.jwt_issuer}/.well-known/jwks.json"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
