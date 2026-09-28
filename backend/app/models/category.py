from uuid import UUID, uuid4

from sqlalchemy import Boolean, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin


class Category(TimestampMixin, Base):
    """user_id NULL = system default (shared, read-only)."""

    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_categories_user_id_name"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID | None] = mapped_column(index=True)
    name: Mapped[str] = mapped_column(String(50))
    color: Mapped[str] = mapped_column(String(9), default="#4F6BED")
    icon: Mapped[str] = mapped_column(String(40), default="tag")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
