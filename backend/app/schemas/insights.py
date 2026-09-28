from datetime import datetime

from pydantic import BaseModel

from app.schemas.goal import GoalOut


class GoalProgress(BaseModel):
    total: int
    completed: int


class DashboardSummary(BaseModel):
    today_goals: list[GoalOut]
    today_progress: GoalProgress
    weekly_goals: GoalProgress
    completed_today: int
    upcoming_deadlines: list[GoalOut]
    streak_days: int
    productivity_score: int
    previous_score: int
    generated_at: datetime


class Series(BaseModel):
    range: str
    labels: list[str]
    values: list[float]


class Progress(BaseModel):
    period: str
    labels: list[str]
    score: list[int] | None
    goals_completed: list[int]
    study_hours: list[float]
