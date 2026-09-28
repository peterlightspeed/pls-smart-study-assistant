from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints

Priority = Literal["low", "medium", "high"]
Scope = Literal["daily", "weekly", "long_term"]
GoalStatus = Literal["active", "completed", "archived"]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]


class GoalCreate(BaseModel):
    title: Title
    description: str | None = Field(default=None, max_length=2000)
    category_id: UUID | None = None
    priority: Priority = "medium"
    scope: Scope = "daily"
    due_at: AwareDatetime | None = None


class GoalUpdate(BaseModel):
    title: Title | None = None
    description: str | None = Field(default=None, max_length=2000)
    category_id: UUID | None = None
    priority: Priority | None = None
    scope: Scope | None = None
    due_at: AwareDatetime | None = None


class GoalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    description: str | None
    category_id: UUID | None
    priority: Priority
    scope: Scope
    due_at: datetime | None
    status: GoalStatus
    completed_at: datetime | None
    created_at: datetime
