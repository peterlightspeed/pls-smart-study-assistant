from datetime import timedelta

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.models import Goal
from app.services import stats
from app.services.activity_service import load_activity
from app.services.common import utcnow
from app.services.settings_service import get_context
from app.utils.datetime import day_bounds_utc, local_today


async def summary(db: AsyncSession, user: CurrentUser) -> dict:
    ctx = await get_context(db, user)
    today = local_today(ctx.tz)
    day_start, day_end = day_bounds_utc(today, ctx.tz)
    wk = stats.week_start_for(today, ctx.week_starts_on)
    wk_start, wk_end = day_bounds_utc(wk, ctx.tz, days=7)
    active = Goal.status == "active"

    today_goals = list(await db.scalars(
        select(Goal).where(
            Goal.user_id == user.id,
            or_(
                and_(active, Goal.due_at < day_end),                                    # due today or overdue
                and_(active, Goal.scope == "daily", Goal.due_at.is_(None)),             # open-ended daily goals
                and_(Goal.completed_at >= day_start, Goal.completed_at < day_end),      # finished today
            ))
        .order_by((Goal.status == "completed"), Goal.due_at.asc().nulls_last()).limit(30)))

    weekly = list(await db.scalars(
        select(Goal.status).where(
            Goal.user_id == user.id, Goal.scope == "weekly",
            or_(and_(Goal.due_at >= wk_start, Goal.due_at < wk_end),
                and_(Goal.completed_at >= wk_start, Goal.completed_at < wk_end),
                and_(active, Goal.due_at.is_(None))))))

    completed_today = await db.scalar(
        select(func.count()).select_from(Goal).where(Goal.user_id == user.id, Goal.completed_at >= day_start, Goal.completed_at < day_end))

    upcoming = list(await db.scalars(
        select(Goal).where(Goal.user_id == user.id, active, Goal.due_at >= utcnow()).order_by(Goal.due_at).limit(5)))

    act = await load_activity(db, user.id, ctx)
    return {
        "today_goals": today_goals,
        "today_progress": {"total": len(today_goals), "completed": sum(g.status == "completed" for g in today_goals)},
        "weekly_goals": {"total": len(weekly), "completed": weekly.count("completed")},
        "completed_today": completed_today or 0,
        "upcoming_deadlines": upcoming,
        "streak_days": stats.current_streak(stats.active_days(act, ctx.tz), today),
        "productivity_score": stats.week_score(act, ctx.tz, wk, ctx.target_minutes),
        "previous_score": stats.week_score(act, ctx.tz, wk - timedelta(days=7), ctx.target_minutes),
        "generated_at": utcnow(),
    }
