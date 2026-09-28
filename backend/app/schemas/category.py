from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
Color = Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")]


class CategoryCreate(BaseModel):
    name: Name
    color: Color = "#4F6BED"
    icon: str = Field(default="tag", max_length=40, pattern=r"^[a-z0-9-]+$")


class CategoryUpdate(BaseModel):
    name: Name | None = None
    color: Color | None = None
    icon: str | None = Field(default=None, max_length=40, pattern=r"^[a-z0-9-]+$")


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    color: str
    icon: str
    is_default: bool
