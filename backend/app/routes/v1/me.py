from fastapi import APIRouter, Response

from app.auth.dependencies import CurrentUserDep
from app.database.session import DbDep
from app.schemas.profile import ProfileOut, ProfileUpdate
from app.schemas.settings import SettingsOut, SettingsUpdate
from app.services import account_service, profile_service, settings_service

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=ProfileOut)
async def get_me(user: CurrentUserDep, db: DbDep):
    return await profile_service.get_or_create_profile(db, user)


@router.patch("", response_model=ProfileOut)
async def update_me(payload: ProfileUpdate, user: CurrentUserDep, db: DbDep):
    return await profile_service.update_profile(db, user, payload)


@router.delete("", status_code=204)
async def delete_me(user: CurrentUserDep, db: DbDep):
    """Permanently deletes the account, all data and stored files."""
    await account_service.delete_account(db, user)
    return Response(status_code=204)


@router.get("/settings", response_model=SettingsOut)
async def get_settings(user: CurrentUserDep, db: DbDep):
    return await settings_service.get_or_create_settings(db, user)


@router.patch("/settings", response_model=SettingsOut)
async def update_settings(payload: SettingsUpdate, user: CurrentUserDep, db: DbDep):
    return await settings_service.update_settings(db, user, payload)
