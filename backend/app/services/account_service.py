from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.models import Category, GalleryItem, Goal, Note, Profile, StudySession, UserSettings
from app.utils import storage


async def delete_account(db: AsyncSession, user: CurrentUser) -> None:
    """Purge storage objects, all rows, then the Supabase auth user. Storage first so failures don't strand files."""
    rows = (await db.execute(select(GalleryItem.storage_path, GalleryItem.thumb_path).where(GalleryItem.user_id == user.id))).all()
    await storage.remove([p for row in rows for p in row])
    for model in (StudySession, Goal, Note, GalleryItem, Category):
        await db.execute(delete(model).where(model.user_id == user.id))
    await db.execute(delete(UserSettings).where(UserSettings.user_id == user.id))
    await db.execute(delete(Profile).where(Profile.id == user.id))
    await db.commit()
    await storage.delete_auth_user(str(user.id))
