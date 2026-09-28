from datetime import time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    theme: Literal["light", "dark", "system"]
    weekly_study_target_minutes: int
    week_starts_on: int
    notifications_enabled: bool
    reminder_time: time | None


class SettingsUpdate(BaseModel):
    theme: Literal["light", "dark", "system"] | None = None
    weekly_study_target_minutes: int | None = Field(default=None, ge=30, le=6000)
    week_starts_on: Literal[1, 7] | None = None  # Monday or Sunday
    notifications_enabled: bool | None = None
    reminder_time: time | None = None
