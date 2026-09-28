"""Business logic for profiles. Every query is scoped to the calling user's id."""
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.models import Profile
from app.schemas.profile import ProfileUpdate


async def get_or_create_profile(db: AsyncSession, user: CurrentUser) -> Profile:
    """The DB trigger normally creates the row; this is the safety net (idempotent, race-safe)."""
    profile = await db.get(Profile, user.id)
    if profile is None:
        await db.execute(
            pg_insert(Profile).values(id=user.id, full_name=user.full_name).on_conflict_do_nothing(index_elements=["id"])
        )
        await db.commit()
        profile = await db.get(Profile, user.id)
    return profile


async def update_profile(db: AsyncSession, user: CurrentUser, data: ProfileUpdate) -> Profile:
    profile = await get_or_create_profile(db, user)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await db.commit()
    await db.refresh(profile)
    return profile
