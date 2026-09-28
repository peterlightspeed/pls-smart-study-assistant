from uuid import UUID

from fastapi import APIRouter, File, Form, Query, Response, UploadFile

from app.auth.dependencies import CurrentUserDep
from app.database.session import DbDep
from app.schemas.gallery import GalleryOut, GalleryUpdate, ItemType
from app.services import gallery_service as svc

router = APIRouter(prefix="/gallery", tags=["gallery"])


@router.get("", response_model=list[GalleryOut])
async def list_gallery(user: CurrentUserDep, db: DbDep, type: ItemType | None = None, q: str | None = Query(None, max_length=100),
                       tag: str | None = Query(None, max_length=30), limit: int = Query(60, ge=1, le=100), offset: int = Query(0, ge=0)):
    return await svc.to_out(await svc.list_items(db, user.id, type, q, tag, limit, offset))


@router.post("", response_model=GalleryOut, status_code=201)
async def upload(user: CurrentUserDep, db: DbDep, file: UploadFile = File(...), title: str = Form(..., min_length=1, max_length=120),
                 item_type: ItemType = Form("image"), tags: str = Form("", max_length=300)):
    item = await svc.upload_item(db, user.id, file, title, item_type, tags)
    return (await svc.to_out([item], with_full=True))[0]


@router.get("/{item_id}", response_model=GalleryOut)
async def get_item(item_id: UUID, user: CurrentUserDep, db: DbDep):
    return (await svc.to_out([await svc.get_item(db, user.id, item_id)], with_full=True))[0]


@router.patch("/{item_id}", response_model=GalleryOut)
async def update_item(item_id: UUID, payload: GalleryUpdate, user: CurrentUserDep, db: DbDep):
    return (await svc.to_out([await svc.update_item(db, user.id, item_id, payload)]))[0]


@router.delete("/{item_id}", status_code=204)
async def delete_item(item_id: UUID, user: CurrentUserDep, db: DbDep):
    await svc.delete_item(db, user.id, item_id)
    return Response(status_code=204)
