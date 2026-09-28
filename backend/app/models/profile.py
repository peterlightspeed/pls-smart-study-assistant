from uuid import UUID

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin


class Profile(TimestampMixin, Base):
    """1:1 with auth.users. The FK to auth.users lives in supabase/sql (Alembic doesn't manage the auth schema)."""

    __tablename__ = "profiles"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    full_name: Mapped[str | None] = mapped_column(String(100))
    avatar_path: Mapped[str | None] = mapped_column(String(300))
    timezone: Mapped[str] = mapped_column(String(64), server_default="UTC")
