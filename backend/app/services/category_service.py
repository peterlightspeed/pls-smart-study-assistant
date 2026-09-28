from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, NotFoundError
from app.models import Category
from app.schemas.category import CategoryCreate, CategoryUpdate


async def list_categories(db: AsyncSession, user_id: UUID):
    q = select(Category).where(or_(Category.user_id == user_id, Category.user_id.is_(None)))
    return list(await db.scalars(q.order_by(Category.is_default.desc(), Category.name)))


async def _own(db, user_id: UUID, cid: UUID) -> Category:
    cat = await db.scalar(select(Category).where(Category.id == cid, Category.user_id == user_id))
    if cat is None:
        raise NotFoundError("category_not_found", "Category not found (default categories can't be changed).")
    return cat


async def create_category(db: AsyncSession, user_id: UUID, data: CategoryCreate) -> Category:
    cat = Category(user_id=user_id, **data.model_dump())
    db.add(cat)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise AppError(409, "category_exists", "You already have a category with that name.") from None
    return cat


async def update_category(db: AsyncSession, user_id: UUID, cid: UUID, data: CategoryUpdate) -> Category:
    cat = await _own(db, user_id, cid)
    for k, v in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(cat, k, v)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise AppError(409, "category_exists", "You already have a category with that name.") from None
    await db.refresh(cat)
    return cat


async def delete_category(db: AsyncSession, user_id: UUID, cid: UUID) -> None:
    await db.delete(await _own(db, user_id, cid))
    await db.commit()
