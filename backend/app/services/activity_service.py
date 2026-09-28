from datetime import timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Goal, StudySession
from app.services.settings_service import UserContext
from app.services.stats import Activity
from app.utils.datetime import day_bounds_utc, local_today

LOOKBACK_DAYS = 400  # enough for a full year of charts plus a long streak; tiny at student scale


async def load_activity(db: AsyncSession, user_id: UUID, ctx: UserContext) -> Activity:
    since, _ = day_bounds_utc(local_today(ctx.tz) - timedelta(days=LOOKBACK_DAYS), ctx.tz)
    goals_done = (await db.scalars(select(Goal.completed_at).where(Goal.user_id == user_id, Goal.completed_at >= since))).all()
    sessions = (await db.execute(
        select(StudySession.completed_at, StudySession.actual_minutes, StudySession.planned_minutes)
        .where(StudySession.user_id == user_id, StudySession.status == "completed", StudySession.completed_at >= since))).all()
    due = (await db.execute(
        select(Goal.due_at, Goal.status).where(Goal.user_id == user_id, Goal.status != "archived", Goal.due_at >= since))).all()
    return Activity(
        goals_done=list(goals_done),
        sessions_done=[(c, a if a is not None else p) for c, a, p in sessions],
        goals_due=[(d, s == "completed") for d, s in due],
    )
