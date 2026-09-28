from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, NotFoundError
from app.models import Category


async def get_owned(db: AsyncSession, model, obj_id: UUID, user_id: UUID, code: str, message: str):
    """Fetch a row only if it belongs to the user. Every user-data read goes through here or filters on user_id."""
    obj = await db.scalar(select(model).where(model.id == obj_id, model.user_id == user_id))
    if obj is None:
        raise NotFoundError(code, message)
    return obj


async def ensure_category(db: AsyncSession, user_id: UUID, category_id: UUID | None) -> None:
    if category_id is None:
        return
    ok = await db.scalar(select(Category.id).where(Category.id == category_id, or_(Category.user_id == user_id, Category.user_id.is_(None))))
    if ok is None:
        raise AppError(422, "invalid_category", "That category doesn't exist.")


def utcnow() -> datetime:
    return datetime.now(UTC)
