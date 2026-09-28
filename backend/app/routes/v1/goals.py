from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Query, Response
from pydantic import AwareDatetime

from app.auth.dependencies import CurrentUserDep
from app.database.session import DbDep
from app.schemas.goal import GoalCreate, GoalOut, GoalStatus, GoalUpdate, Priority, Scope
from app.services import goal_service as svc

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=list[GoalOut])
async def list_goals(
    user: CurrentUserDep, db: DbDep,
    status: GoalStatus | None = None, scope: Scope | None = None, priority: Priority | None = None,
    category_id: UUID | None = None, due_from: AwareDatetime | None = None, due_to: AwareDatetime | None = None,
    q: str | None = Query(None, max_length=100), sort: Literal["due", "priority", "created"] = "due",
    limit: int = Query(100, ge=1, le=200), offset: int = Query(0, ge=0),
):
    return await svc.list_goals(db, user.id, status=status, scope=scope, priority=priority, category_id=category_id,
                                due_from=due_from, due_to=due_to, q=q, sort=sort, limit=limit, offset=offset)


@router.post("", response_model=GoalOut, status_code=201)
async def create_goal(payload: GoalCreate, user: CurrentUserDep, db: DbDep):
    return await svc.create_goal(db, user.id, payload)


@router.get("/{goal_id}", response_model=GoalOut)
async def get_goal(goal_id: UUID, user: CurrentUserDep, db: DbDep):
    return await svc.get_goal(db, user.id, goal_id)


@router.patch("/{goal_id}", response_model=GoalOut)
async def update_goal(goal_id: UUID, payload: GoalUpdate, user: CurrentUserDep, db: DbDep):
    return await svc.update_goal(db, user.id, goal_id, payload)


@router.delete("/{goal_id}", status_code=204)
async def delete_goal(goal_id: UUID, user: CurrentUserDep, db: DbDep):
    await svc.delete_goal(db, user.id, goal_id)
    return Response(status_code=204)


@router.post("/{goal_id}/complete", response_model=GoalOut)
async def complete_goal(goal_id: UUID, user: CurrentUserDep, db: DbDep):
    return await svc.set_completed(db, user.id, goal_id, True)


@router.post("/{goal_id}/reopen", response_model=GoalOut)
async def reopen_goal(goal_id: UUID, user: CurrentUserDep, db: DbDep):
    return await svc.set_completed(db, user.id, goal_id, False)
