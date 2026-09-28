from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class NoteCreate(BaseModel):
    title: str = Field(default="Untitled", min_length=1, max_length=200)
    content: dict = Field(default_factory=lambda: {"ops": []})  # Quill Delta
    category_id: UUID | None = None
    is_pinned: bool = False


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: dict | None = None
    category_id: UUID | None = None
    is_pinned: bool | None = None


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    title: str
    content: dict
    category_id: UUID | None
    is_pinned: bool
    created_at: datetime
    updated_at: datetime


class NoteListItem(BaseModel):
    id: UUID
    title: str
    preview: str
    category_id: UUID | None
    is_pinned: bool
    updated_at: datetime
