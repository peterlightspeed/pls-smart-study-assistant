from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.services import stats
from app.services.activity_service import load_activity
from app.services.settings_service import get_context
from app.utils.datetime import local_today


def _months_back(today: date, n: int) -> list[date]:
    """First day of each of the last n months, oldest first."""
    out, y, m = [], today.year, today.month
    for _ in range(n):
        out.append(date(y, m, 1))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return out[::-1]


def _bucket(range_: str, today: date) -> tuple[list[str], list[tuple[date, date]]]:
    """Returns labels and [start, end) local-date windows for a range."""
    if range_ == "year":
        starts = _months_back(today, 12)
        ends = starts[1:] + [(today.replace(day=28) + timedelta(days=4)).replace(day=1)]
        return [s.strftime("%Y-%m") for s in starts], list(zip(starts, ends, strict=True))
    n = 7 if range_ == "week" else 30
    days = [today - timedelta(days=i) for i in range(n - 1, -1, -1)]
    return [d.isoformat() for d in days], [(d, d + timedelta(days=1)) for d in days]


async def study_hours(db: AsyncSession, user: CurrentUser, range_: str) -> dict:
    ctx = await get_context(db, user)
    act = await load_activity(db, user.id, ctx)
    per_day = stats.hours_by_day(act.sessions_done, ctx.tz)
    labels, windows = _bucket(range_, local_today(ctx.tz))
    values = [round(sum(m for d, m in per_day.items() if s <= d < e) / 60, 2) for s, e in windows]
    return {"range": range_, "labels": labels, "values": values}


async def goals_completed(db: AsyncSession, user: CurrentUser, range_: str) -> dict:
    ctx = await get_context(db, user)
    act = await load_activity(db, user.id, ctx)
    per_day = stats.count_by_day(act.goals_done, ctx.tz)
    labels, windows = _bucket(range_, local_today(ctx.tz))
    values = [float(sum(c for d, c in per_day.items() if s <= d < e)) for s, e in windows]
    return {"range": range_, "labels": labels, "values": values}


async def progress(db: AsyncSession, user: CurrentUser, period: str) -> dict:
    ctx = await get_context(db, user)
    act = await load_activity(db, user.id, ctx)
    today = local_today(ctx.tz)
    goals_by_day = stats.count_by_day(act.goals_done, ctx.tz)
    mins_by_day = stats.hours_by_day(act.sessions_done, ctx.tz)

    if period == "weekly":
        this_week = stats.week_start_for(today, ctx.week_starts_on)
        starts = [this_week - timedelta(days=7 * i) for i in range(7, -1, -1)]
        windows = [(s, s + timedelta(days=7)) for s in starts]
        score = [stats.week_score(act, ctx.tz, s, ctx.target_minutes) for s in starts]
        labels = [s.isoformat() for s in starts]
    else:
        starts = _months_back(today, 6)
        ends = starts[1:] + [(today.replace(day=28) + timedelta(days=4)).replace(day=1)]
        windows, score = list(zip(starts, ends, strict=True)), None
        labels = [s.strftime("%Y-%m") for s in starts]

    return {
        "period": period, "labels": labels, "score": score,
        "goals_completed": [sum(c for d, c in goals_by_day.items() if s <= d < e) for s, e in windows],
        "study_hours": [round(sum(m for d, m in mins_by_day.items() if s <= d < e) / 60, 2) for s, e in windows],
    }
