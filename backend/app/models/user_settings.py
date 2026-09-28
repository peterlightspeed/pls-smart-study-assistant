from datetime import time
from uuid import UUID

from sqlalchemy import Boolean, CheckConstraint, Integer, SmallInteger, String, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin


class UserSettings(TimestampMixin, Base):
    __tablename__ = "user_settings"
    __table_args__ = (CheckConstraint("theme in ('light','dark','system')", name="theme"),)

    user_id: Mapped[UUID] = mapped_column(primary_key=True)
    theme: Mapped[str] = mapped_column(String(10), default="system")
    weekly_study_target_minutes: Mapped[int] = mapped_column(Integer, default=600)
    week_starts_on: Mapped[int] = mapped_column(SmallInteger, default=1)  # ISO: 1=Mon ... 7=Sun
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    reminder_time: Mapped[time | None] = mapped_column(Time)
