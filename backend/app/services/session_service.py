from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select

from app.core.errors import AppError
from app.models import Goal, StudySession
from app.schemas.study_session import SessionComplete, SessionCreate, SessionUpdate
from app.services.common import ensure_category, get_owned, utcnow

MAX_CALENDAR_DAYS = 100


async def _check_links(db, user_id, goal_id, category_id):
    await ensure_category(db, user_id, category_id)
    if goal_id:
        await get_owned(db, Goal, goal_id, user_id, "goal_not_found", "The linked goal doesn't exist.")


async def list_sessions(db, user_id: UUID, start: datetime | None, end: datetime | None, status: str | None):
    stmt = select(StudySession).where(StudySession.user_id == user_id)
    if start:
        stmt = stmt.where(StudySession.scheduled_start >= start)
    if end:
        stmt = stmt.where(StudySession.scheduled_start < end)
    if status:
        stmt = stmt.where(StudySession.status == status)
    return list(await db.scalars(stmt.order_by(StudySession.scheduled_start).limit(500)))


async def calendar(db, user_id: UUID, start: datetime, end: datetime):
    if end <= start or end - start > timedelta(days=MAX_CALENDAR_DAYS):
        raise AppError(422, "invalid_range", f"Choose a range of up to {MAX_CALENDAR_DAYS} days.")
    sessions = await list_sessions(db, user_id, start, end, None)
    deadlines = list(await db.scalars(
        select(Goal).where(Goal.user_id == user_id, Goal.status != "archived", Goal.due_at >= start, Goal.due_at < end)
        .order_by(Goal.due_at).limit(500)))
    return {"sessions": sessions, "deadlines": deadlines}


async def get_session(db, user_id: UUID, sid: UUID) -> StudySession:
    return await get_owned(db, StudySession, sid, user_id, "session_not_found", "Study session not found.")


async def create_session(db, user_id: UUID, data: SessionCreate) -> StudySession:
    await _check_links(db, user_id, data.goal_id, data.category_id)
    s = StudySession(user_id=user_id, **data.model_dump())
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return s


async def update_session(db, user_id: UUID, sid: UUID, data: SessionUpdate) -> StudySession:
    s = await get_session(db, user_id, sid)
    changes = data.model_dump(exclude_unset=True)
    if s.status in ("completed", "skipped") and ("planned_minutes" in changes or "scheduled_start" in changes):
        raise AppError(409, "session_closed", "Finished sessions can't be rescheduled.")
    await _check_links(db, user_id, changes.get("goal_id"), changes.get("category_id"))
    for k, v in changes.items():
        setattr(s, k, v)
    await db.commit()
    await db.refresh(s)
    return s


async def delete_session(db, user_id: UUID, sid: UUID) -> None:
    await db.delete(await get_session(db, user_id, sid))
    await db.commit()


async def start_session(db, user_id: UUID, sid: UUID) -> StudySession:
    s = await get_session(db, user_id, sid)
    if s.status != "planned":
        raise AppError(409, "invalid_transition", "Only planned sessions can be started.")
    s.status = "in_progress"
    await db.commit()
    await db.refresh(s)
    return s


async def complete_session(db, user_id: UUID, sid: UUID, data: SessionComplete | None) -> StudySession:
    s = await get_session(db, user_id, sid)
    if s.status not in ("planned", "in_progress"):
        raise AppError(409, "invalid_transition", "This session is already finished.")
    s.status, s.completed_at = "completed", utcnow()
    s.actual_minutes = data.actual_minutes if data and data.actual_minutes is not None else s.planned_minutes
    await db.commit()
    await db.refresh(s)
    return s


async def skip_session(db, user_id: UUID, sid: UUID) -> StudySession:
    s = await get_session(db, user_id, sid)
    if s.status not in ("planned", "in_progress"):
        raise AppError(409, "invalid_transition", "This session is already finished.")
    s.status = "skipped"
    await db.commit()
    await db.refresh(s)
    return s
