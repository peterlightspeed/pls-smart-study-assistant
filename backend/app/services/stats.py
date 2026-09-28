"""Pure functions for streaks, scores and bucketing (no DB, fully unit-tested).

Definitions (see PRD):
- Active day: a local day with >=1 goal completed or study session completed.
- Streak: consecutive active days ending today (or yesterday, so it isn't lost before you've studied today).
- Weekly productivity score (0-100) = 40% goal completion + 40% study time vs target + 20% consistency.
"""
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo


@dataclass
class Activity:
    goals_done: list[datetime] = field(default_factory=list)                 # completed_at of completed goals
    sessions_done: list[tuple[datetime, int]] = field(default_factory=list)  # (completed_at, minutes studied)
    goals_due: list[tuple[datetime, bool]] = field(default_factory=list)     # (due_at, is_completed)


def local_date(dt: datetime, tz: ZoneInfo) -> date:
    return dt.astimezone(tz).date()


def active_days(a: Activity, tz: ZoneInfo) -> set[date]:
    return {local_date(d, tz) for d in a.goals_done} | {local_date(d, tz) for d, _ in a.sessions_done}


def current_streak(days: set[date], today: date) -> int:
    cursor = today if today in days else today - timedelta(days=1)
    n = 0
    while cursor in days:
        n += 1
        cursor -= timedelta(days=1)
    return n


def week_start_for(d: date, week_starts_on: int) -> date:
    """week_starts_on uses ISO numbering: 1=Monday ... 7=Sunday."""
    return d - timedelta(days=(d.isoweekday() - week_starts_on) % 7)


def week_score(a: Activity, tz: ZoneInfo, start: date, target_minutes: int) -> int:
    end = start + timedelta(days=7)
    def in_week(dt: datetime) -> bool:
        return start <= local_date(dt, tz) < end


    due = [done for d, done in a.goals_due if in_week(d)]
    if due:
        goal_part = sum(due) / len(due)
    else:  # nothing was due: reward the week if the user still got something done
        goal_part = 1.0 if any(in_week(d) for d in a.goals_done) else 0.0

    minutes = sum(m for d, m in a.sessions_done if in_week(d))
    study_part = min(1.0, minutes / target_minutes) if target_minutes > 0 else 0.0

    week_days = {d for d in active_days(a, tz) if start <= d < end}
    consistency = min(1.0, len(week_days) / 7)
    return round(40 * goal_part + 40 * study_part + 20 * consistency)


def count_by_day(dts: list[datetime], tz: ZoneInfo) -> Counter:
    return Counter(local_date(d, tz) for d in dts)


def hours_by_day(items: list[tuple[datetime, int]], tz: ZoneInfo) -> Counter:
    c: Counter = Counter()
    for d, m in items:
        c[local_date(d, tz)] += m
    return c
