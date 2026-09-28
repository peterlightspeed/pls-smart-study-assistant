from dataclasses import dataclass
from zoneinfo import ZoneInfo

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.models import UserSettings
from app.schemas.settings import SettingsUpdate
from app.services.profile_service import get_or_create_profile


async def get_or_create_settings(db: AsyncSession, user: CurrentUser) -> UserSettings:
    row = await db.get(UserSettings, user.id)
    if row is None:
        await db.execute(pg_insert(UserSettings).values(user_id=user.id).on_conflict_do_nothing(index_elements=["user_id"]))
        await db.commit()
        row = await db.get(UserSettings, user.id)
    return row


async def update_settings(db: AsyncSession, user: CurrentUser, data: SettingsUpdate) -> UserSettings:
    row = await get_or_create_settings(db, user)
    for k, v in data.model_dump(exclude_unset=True).items():
        if v is None and k != "reminder_time":
            continue
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return row


@dataclass(frozen=True)
class UserContext:
    tz: ZoneInfo
    target_minutes: int
    week_starts_on: int


async def get_context(db: AsyncSession, user: CurrentUser) -> UserContext:
    profile = await get_or_create_profile(db, user)
    s = await get_or_create_settings(db, user)
    try:
        tz = ZoneInfo(profile.timezone)
    except Exception:
        tz = ZoneInfo("UTC")
    return UserContext(tz, s.weekly_study_target_minutes, s.week_starts_on)
