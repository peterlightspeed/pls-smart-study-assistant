from uuid import UUID

from fastapi import APIRouter, Query, Response
from pydantic import AwareDatetime

from app.auth.dependencies import CurrentUserDep
from app.database.session import DbDep
from app.schemas.study_session import (
    CalendarOut,
    SessionComplete,
    SessionCreate,
    SessionOut,
    SessionStatus,
    SessionUpdate,
)
from app.services import session_service as svc

router = APIRouter(tags=["study-sessions"])


@router.get("/study-sessions", response_model=list[SessionOut])
async def list_sessions(user: CurrentUserDep, db: DbDep, from_: AwareDatetime | None = Query(None, alias="from"),
                        to: AwareDatetime | None = None, status: SessionStatus | None = None):
    return await svc.list_sessions(db, user.id, from_, to, status)


@router.post("/study-sessions", response_model=SessionOut, status_code=201)
async def create_session(payload: SessionCreate, user: CurrentUserDep, db: DbDep):
    return await svc.create_session(db, user.id, payload)


@router.get("/study-sessions/{session_id}", response_model=SessionOut)
async def get_session(session_id: UUID, user: CurrentUserDep, db: DbDep):
    return await svc.get_session(db, user.id, session_id)


@router.patch("/study-sessions/{session_id}", response_model=SessionOut)
async def update_session(session_id: UUID, payload: SessionUpdate, user: CurrentUserDep, db: DbDep):
    return await svc.update_session(db, user.id, session_id, payload)


@router.delete("/study-sessions/{session_id}", status_code=204)
async def delete_session(session_id: UUID, user: CurrentUserDep, db: DbDep):
    await svc.delete_session(db, user.id, session_id)
    return Response(status_code=204)


@router.post("/study-sessions/{session_id}/start", response_model=SessionOut)
async def start_session(session_id: UUID, user: CurrentUserDep, db: DbDep):
    return await svc.start_session(db, user.id, session_id)


@router.post("/study-sessions/{session_id}/complete", response_model=SessionOut)
async def complete_session(session_id: UUID, user: CurrentUserDep, db: DbDep, payload: SessionComplete | None = None):
    return await svc.complete_session(db, user.id, session_id, payload)


@router.post("/study-sessions/{session_id}/skip", response_model=SessionOut)
async def skip_session(session_id: UUID, user: CurrentUserDep, db: DbDep):
    return await svc.skip_session(db, user.id, session_id)


@router.get("/calendar", response_model=CalendarOut)
async def calendar(user: CurrentUserDep, db: DbDep, from_: AwareDatetime = Query(alias="from"), to: AwareDatetime = Query()):
    return await svc.calendar(db, user.id, from_, to)
