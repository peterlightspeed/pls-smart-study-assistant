from uuid import UUID, uuid4

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin


class Note(TimestampMixin, Base):
    __tablename__ = "notes"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(index=True)
    title: Mapped[str] = mapped_column(String(200), default="Untitled")
    content: Mapped[dict] = mapped_column(JSONB, default=dict)  # Quill Delta
    content_text: Mapped[str] = mapped_column(Text, default="")  # derived server-side, used for search
    category_id: Mapped[UUID | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
