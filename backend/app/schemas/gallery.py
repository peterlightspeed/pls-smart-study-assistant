from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

ItemType = Literal["certificate", "assignment", "note", "image"]


class GalleryOut(BaseModel):
    id: UUID
    title: str
    item_type: ItemType
    tags: list[str]
    size_bytes: int
    original_size_bytes: int
    width: int
    height: int
    created_at: datetime
    url: str | None = None
    thumb_url: str | None = None


class GalleryUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    item_type: ItemType | None = None
    tags: list[str] | None = Field(default=None, max_length=10)
