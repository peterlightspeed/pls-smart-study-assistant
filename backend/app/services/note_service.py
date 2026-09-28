import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.models import Note
from app.schemas.note import NoteCreate, NoteUpdate
from app.services.common import ensure_category, get_owned

MAX_CONTENT_BYTES = 500_000


def delta_to_text(delta: dict) -> str:
    """Validate a Quill Delta and derive plain text for search/previews.
    Notes are stored as structured JSON (never raw HTML), so there is no HTML to inject on render."""
    ops = delta.get("ops") if isinstance(delta, dict) else None
    if not isinstance(ops, list):
        raise AppError(422, "invalid_note_content", "Note content must be a Quill Delta with an 'ops' list.")
    if len(json.dumps(delta)) > MAX_CONTENT_BYTES:
        raise AppError(413, "note_too_large", "This note is too large to save.")
    return "".join(op["insert"] for op in ops if isinstance(op, dict) and isinstance(op.get("insert"), str)).strip()


async def list_notes(db: AsyncSession, user_id: UUID, q: str | None, pinned: bool | None, category_id: UUID | None, limit: int, offset: int):
    stmt = select(Note).where(Note.user_id == user_id)
    if pinned is not None:
        stmt = stmt.where(Note.is_pinned == pinned)
    if category_id:
        stmt = stmt.where(Note.category_id == category_id)
    if q:
        like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        stmt = stmt.where(Note.title.ilike(like, escape="\\") | Note.content_text.ilike(like, escape="\\"))
    rows = await db.scalars(stmt.order_by(Note.is_pinned.desc(), Note.updated_at.desc()).limit(limit).offset(offset))
    return [
        {"id": n.id, "title": n.title, "preview": n.content_text[:140], "category_id": n.category_id,
         "is_pinned": n.is_pinned, "updated_at": n.updated_at}
        for n in rows
    ]


async def get_note(db, user_id: UUID, nid: UUID) -> Note:
    return await get_owned(db, Note, nid, user_id, "note_not_found", "Note not found.")


async def create_note(db, user_id: UUID, data: NoteCreate) -> Note:
    await ensure_category(db, user_id, data.category_id)
    note = Note(user_id=user_id, title=data.title, content=data.content, content_text=delta_to_text(data.content),
                category_id=data.category_id, is_pinned=data.is_pinned)
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


async def update_note(db, user_id: UUID, nid: UUID, data: NoteUpdate) -> Note:
    note = await get_note(db, user_id, nid)
    changes = data.model_dump(exclude_unset=True)
    if "content" in changes:
        if changes["content"] is None:
            raise AppError(422, "invalid_note_content", "Content can't be null.")
        note.content_text = delta_to_text(changes["content"])
    if "category_id" in changes:
        await ensure_category(db, user_id, changes["category_id"])
    for k, v in changes.items():
        if k == "title" and v is None:
            continue
        setattr(note, k, v)
    await db.commit()
    await db.refresh(note)
    return note


async def delete_note(db, user_id: UUID, nid: UUID) -> None:
    await db.delete(await get_note(db, user_id, nid))
    await db.commit()
