from uuid import UUID

from fastapi import APIRouter, Query, Response

from app.auth.dependencies import CurrentUserDep
from app.database.session import DbDep
from app.schemas.note import NoteCreate, NoteListItem, NoteOut, NoteUpdate
from app.services import note_service as svc

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("", response_model=list[NoteListItem])
async def list_notes(user: CurrentUserDep, db: DbDep, q: str | None = Query(None, max_length=100), pinned: bool | None = None,
                     category_id: UUID | None = None, limit: int = Query(100, ge=1, le=200), offset: int = Query(0, ge=0)):
    return await svc.list_notes(db, user.id, q, pinned, category_id, limit, offset)


@router.post("", response_model=NoteOut, status_code=201)
async def create_note(payload: NoteCreate, user: CurrentUserDep, db: DbDep):
    return await svc.create_note(db, user.id, payload)


@router.get("/{note_id}", response_model=NoteOut)
async def get_note(note_id: UUID, user: CurrentUserDep, db: DbDep):
    return await svc.get_note(db, user.id, note_id)


@router.patch("/{note_id}", response_model=NoteOut)
async def update_note(note_id: UUID, payload: NoteUpdate, user: CurrentUserDep, db: DbDep):
    return await svc.update_note(db, user.id, note_id, payload)


@router.delete("/{note_id}", status_code=204)
async def delete_note(note_id: UUID, user: CurrentUserDep, db: DbDep):
    await svc.delete_note(db, user.id, note_id)
    return Response(status_code=204)
