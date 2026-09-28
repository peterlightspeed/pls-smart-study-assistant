from uuid import UUID, uuid4

from sqlalchemy import BigInteger, CheckConstraint, Index, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin


class GalleryItem(TimestampMixin, Base):
    __tablename__ = "gallery_items"
    __table_args__ = (
        CheckConstraint("item_type in ('certificate','assignment','note','image')", name="item_type"),
        Index("ix_gallery_user_type_created", "user_id", "item_type", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(index=True)
    title: Mapped[str] = mapped_column(String(120))
    item_type: Mapped[str] = mapped_column(String(12), default="image")
    storage_path: Mapped[str] = mapped_column(String(300))
    thumb_path: Mapped[str] = mapped_column(String(300))
    mime_type: Mapped[str] = mapped_column(String(50), default="image/webp")
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    original_size_bytes: Mapped[int] = mapped_column(BigInteger)
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String(30)), server_default="{}", default=list)
