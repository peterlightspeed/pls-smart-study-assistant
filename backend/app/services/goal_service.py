from datetime import datetime
from uuid import UUID

from sqlalchemy import case, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.models import Goal
from app.schemas.goal import GoalCreate, GoalUpdate
from app.services.common import ensure_category, get_owned, utcnow

_PRIORITY_RANK = case((Goal.priority == "high", 0), (Goal.priority == "medium", 1), else_=2)


async def list_goals(db: AsyncSession, user_id: UUID, *, status=None, scope=None, priority=None, category_id=None,
                     due_from: datetime | None = None, due_to: datetime | None = None, q: str | None = None,
                     sort: str = "due", limit: int = 100, offset: int = 0):
    stmt = select(Goal).where(Goal.user_id == user_id)
    stmt = stmt.where(Goal.status == status) if status else stmt.where(Goal.status != "archived")
    if scope:
        stmt = stmt.where(Goal.scope == scope)
    if priority:
        stmt = stmt.where(Goal.priority == priority)
    if category_id:
        stmt = stmt.where(Goal.category_id == category_id)
    if due_from:
        stmt = stmt.where(Goal.due_at >= due_from)
    if due_to:
        stmt = stmt.where(Goal.due_at < due_to)
    if q:
        escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        stmt = stmt.where(Goal.title.ilike(f"%{escaped}%", escape="\\"))
    order = {
        "due": [(Goal.status == "completed"), Goal.due_at.asc().nulls_last(), Goal.created_at.desc()],
        "priority": [(Goal.status == "completed"), _PRIORITY_RANK, Goal.due_at.asc().nulls_last()],
        "created": [Goal.created_at.desc()],
    }[sort]
    return list(await db.scalars(stmt.order_by(*order).limit(limit).offset(offset)))


async def get_goal(db: AsyncSession, user_id: UUID, goal_id: UUID) -> Goal:
    return await get_owned(db, Goal, goal_id, user_id, "goal_not_found", "Goal not found.")


async def create_goal(db: AsyncSession, user_id: UUID, data: GoalCreate) -> Goal:
    await ensure_category(db, user_id, data.category_id)
    goal = Goal(user_id=user_id, **data.model_dump())
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return goal


async def update_goal(db: AsyncSession, user_id: UUID, goal_id: UUID, data: GoalUpdate) -> Goal:
    goal = await get_goal(db, user_id, goal_id)
    changes = data.model_dump(exclude_unset=True)
    if changes.get("title", "x") is None:
        raise AppError(422, "validation_error", "Title can't be empty.")
    await ensure_category(db, user_id, changes.get("category_id"))
    for k, v in changes.items():
        setattr(goal, k, v)
    await db.commit()
    await db.refresh(goal)
    return goal


async def delete_goal(db: AsyncSession, user_id: UUID, goal_id: UUID) -> None:
    await db.delete(await get_goal(db, user_id, goal_id))
    await db.commit()


async def set_completed(db: AsyncSession, user_id: UUID, goal_id: UUID, done: bool) -> Goal:
    goal = await get_goal(db, user_id, goal_id)
    goal.status, goal.completed_at = ("completed", utcnow()) if done else ("active", None)
    await db.commit()
    await db.refresh(goal)
    return goal
