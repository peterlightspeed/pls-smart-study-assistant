import uuid
from uuid import UUID

from fastapi import UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError
from app.models import GalleryItem
from app.schemas.gallery import GalleryUpdate
from app.services.common import get_owned
from app.utils import storage
from app.utils.image import process_image


def clean_tags(raw: str | list[str]) -> list[str]:
    items = raw.split(",") if isinstance(raw, str) else raw
    seen: list[str] = []
    for t in (i.strip().lower()[:30] for i in items):
        if t and t not in seen:
            seen.append(t)
    return seen[:10]


async def to_out(items: list[GalleryItem], with_full: bool = False) -> list[dict]:
    paths = [i.thumb_path for i in items] + ([i.storage_path for i in items] if with_full else [])
    urls = await storage.sign_many(paths)
    return [
        {"id": i.id, "title": i.title, "item_type": i.item_type, "tags": list(i.tags or []), "size_bytes": i.size_bytes,
         "original_size_bytes": i.original_size_bytes, "width": i.width, "height": i.height, "created_at": i.created_at,
         "thumb_url": urls.get(i.thumb_path), "url": urls.get(i.storage_path) if with_full else None}
        for i in items
    ]


async def list_items(db: AsyncSession, user_id: UUID, item_type, q, tag, limit, offset):
    stmt = select(GalleryItem).where(GalleryItem.user_id == user_id)
    if item_type:
        stmt = stmt.where(GalleryItem.item_type == item_type)
    if tag:
        stmt = stmt.where(GalleryItem.tags.any(tag.strip().lower()))
    if q:
        like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        stmt = stmt.where(GalleryItem.title.ilike(like, escape="\\"))
    return list(await db.scalars(stmt.order_by(GalleryItem.created_at.desc()).limit(limit).offset(offset)))


async def get_item(db, user_id: UUID, iid: UUID) -> GalleryItem:
    return await get_owned(db, GalleryItem, iid, user_id, "gallery_item_not_found", "Gallery item not found.")


async def upload_item(db: AsyncSession, user_id: UUID, file: UploadFile, title: str, item_type: str, tags: str) -> GalleryItem:
    limit = get_settings().max_upload_mb * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise AppError(413, "file_too_large", f"Images can be up to {get_settings().max_upload_mb} MB.")
    processed = await run_in_threadpool(process_image, data)

    key = uuid.uuid4().hex
    main_path, thumb_path = f"{user_id}/{key}.webp", f"{user_id}/thumbs/{key}.webp"
    await storage.upload(main_path, processed.main)
    try:
        await storage.upload(thumb_path, processed.thumb)
        item = GalleryItem(user_id=user_id, title=title.strip(), item_type=item_type, storage_path=main_path,
                           thumb_path=thumb_path, size_bytes=len(processed.main), original_size_bytes=len(data),
                           width=processed.width, height=processed.height, tags=clean_tags(tags))
        db.add(item)
        await db.commit()
    except Exception:
        await storage.remove([main_path, thumb_path])  # no orphaned files if anything after the first upload fails
        raise
    await db.refresh(item)
    return item


async def update_item(db, user_id: UUID, iid: UUID, data: GalleryUpdate) -> GalleryItem:
    item = await get_item(db, user_id, iid)
    for k, v in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(item, k, clean_tags(v) if k == "tags" else v)
    await db.commit()
    await db.refresh(item)
    return item


async def delete_item(db, user_id: UUID, iid: UUID) -> None:
    item = await get_item(db, user_id, iid)
    paths = [item.storage_path, item.thumb_path]
    await db.delete(item)
    await db.commit()
    await storage.remove(paths)
