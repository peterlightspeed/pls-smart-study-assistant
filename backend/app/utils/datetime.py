from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo


def local_today(tz: ZoneInfo) -> date:
    return datetime.now(UTC).astimezone(tz).date()


def day_bounds_utc(d: date, tz: ZoneInfo, days: int = 1) -> tuple[datetime, datetime]:
    """[start, end) of `days` local days beginning at local date d, as UTC datetimes."""
    start = datetime.combine(d, time.min, tzinfo=tz)
    end = datetime.combine(d + timedelta(days=days), time.min, tzinfo=tz)
    return start.astimezone(UTC), end.astimezone(UTC)
