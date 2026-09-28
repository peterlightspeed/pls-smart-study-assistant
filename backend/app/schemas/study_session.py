from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.schemas.goal import GoalOut, Title

SessionStatus = Literal["planned", "in_progress", "completed", "skipped"]


class SessionCreate(BaseModel):
    title: Title
    scheduled_start: AwareDatetime
    planned_minutes: int = Field(ge=5, le=720)
    goal_id: UUID | None = None
    category_id: UUID | None = None
    notes: str | None = Field(default=None, max_length=2000)


class SessionUpdate(BaseModel):
    title: Title | None = None
    scheduled_start: AwareDatetime | None = None
    planned_minutes: int | None = Field(default=None, ge=5, le=720)
    goal_id: UUID | None = None
    category_id: UUID | None = None
    notes: str | None = Field(default=None, max_length=2000)


class SessionComplete(BaseModel):
    actual_minutes: int | None = Field(default=None, ge=0, le=1440)


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    goal_id: UUID | None
    category_id: UUID | None
    scheduled_start: datetime
    planned_minutes: int
    actual_minutes: int | None
    status: SessionStatus
    completed_at: datetime | None
    notes: str | None


class CalendarOut(BaseModel):
    sessions: list[SessionOut]
    deadlines: list[GoalOut]
