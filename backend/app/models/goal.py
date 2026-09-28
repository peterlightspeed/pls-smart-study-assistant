from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin


class Goal(TimestampMixin, Base):
    __tablename__ = "goals"
    __table_args__ = (
        CheckConstraint("priority in ('low','medium','high')", name="priority"),
        CheckConstraint("scope in ('daily','weekly','long_term')", name="scope"),
        CheckConstraint("status in ('active','completed','archived')", name="status"),
        Index("ix_goals_user_status_due", "user_id", "status", "due_at"),
        Index("ix_goals_user_completed", "user_id", "completed_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    category_id: Mapped[UUID | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"))
    priority: Mapped[str] = mapped_column(String(10), default="medium")
    scope: Mapped[str] = mapped_column(String(12), default="daily")
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(10), default="active")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
