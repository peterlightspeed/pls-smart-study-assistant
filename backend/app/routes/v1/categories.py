from uuid import UUID

from fastapi import APIRouter, Response

from app.auth.dependencies import CurrentUserDep
from app.database.session import DbDep
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate
from app.services import category_service as svc

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
async def list_categories(user: CurrentUserDep, db: DbDep):
    return await svc.list_categories(db, user.id)


@router.post("", response_model=CategoryOut, status_code=201)
async def create_category(payload: CategoryCreate, user: CurrentUserDep, db: DbDep):
    return await svc.create_category(db, user.id, payload)


@router.patch("/{category_id}", response_model=CategoryOut)
async def update_category(category_id: UUID, payload: CategoryUpdate, user: CurrentUserDep, db: DbDep):
    return await svc.update_category(db, user.id, category_id, payload)


@router.delete("/{category_id}", status_code=204)
async def delete_category(category_id: UUID, user: CurrentUserDep, db: DbDep):
    await svc.delete_category(db, user.id, category_id)
    return Response(status_code=204)
