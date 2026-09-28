from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.services import stats
from app.services.note_service import delta_to_text

UTC = ZoneInfo("UTC")
LAGOS = ZoneInfo("Africa/Lagos")


def at(d: date, hour=12, tz=timezone.utc):
    return datetime(d.year, d.month, d.day, hour, tzinfo=tz)


def test_streak_counts_back_from_today():
    today = date(2026, 9, 24)
    days = {today, today - timedelta(1), today - timedelta(2)}
    assert stats.current_streak(days, today) == 3


def test_streak_survives_until_end_of_today():
    today = date(2026, 9, 24)
    assert stats.current_streak({today - timedelta(1), today - timedelta(2)}, today) == 2


def test_streak_breaks_after_a_missed_day():
    today = date(2026, 9, 24)
    assert stats.current_streak({today - timedelta(2)}, today) == 0


def test_local_day_uses_user_timezone():
    # 23:30 UTC on the 23rd is already the 24th in Lagos (UTC+1)
    a = stats.Activity(goals_done=[datetime(2026, 9, 23, 23, 30, tzinfo=timezone.utc)])
    assert stats.active_days(a, LAGOS) == {date(2026, 9, 24)}
    assert stats.active_days(a, UTC) == {date(2026, 9, 23)}


def test_week_start_respects_setting():
    thu = date(2026, 9, 24)
    assert stats.week_start_for(thu, 1) == date(2026, 9, 21)  # Monday
    assert stats.week_start_for(thu, 7) == date(2026, 9, 20)  # Sunday


def test_perfect_week_scores_100():
    start = date(2026, 9, 21)
    days = [start + timedelta(i) for i in range(7)]
    a = stats.Activity(
        goals_done=[at(d) for d in days],
        sessions_done=[(at(d), 100) for d in days],       # 700 min >= 600 target
        goals_due=[(at(days[2]), True), (at(days[4]), True)],
    )
    assert stats.week_score(a, UTC, start, 600) == 100


def test_empty_week_scores_zero():
    assert stats.week_score(stats.Activity(), UTC, date(2026, 9, 21), 600) == 0


def test_partial_week_score():
    start = date(2026, 9, 21)
    a = stats.Activity(
        goals_done=[at(start)],
        sessions_done=[(at(start), 300)],                  # half the target
        goals_due=[(at(start), True), (at(start + timedelta(1)), False)],  # 50% of due goals done
    )
    # 40*0.5 + 40*0.5 + 20*(1/7)
    assert stats.week_score(a, UTC, start, 600) == round(20 + 20 + 20 / 7)


def test_no_goals_due_but_progress_counts():
    start = date(2026, 9, 21)
    a = stats.Activity(goals_done=[at(start)])
    assert stats.week_score(a, UTC, start, 600) == round(40 + 0 + 20 / 7)


def test_delta_to_text_extracts_plain_text():
    d = {"ops": [{"insert": "Hello "}, {"insert": "world", "attributes": {"bold": True}}, {"insert": {"image": "x"}}, {"insert": "\n"}]}
    assert delta_to_text(d) == "Hello world"
