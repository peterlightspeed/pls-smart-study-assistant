from typing import Literal

from fastapi import APIRouter

from app.auth.dependencies import CurrentUserDep
from app.database.session import DbDep
from app.schemas.insights import Progress, Series
from app.services import analytics_service as svc

router = APIRouter(prefix="/analytics", tags=["analytics"])
Range = Literal["week", "month", "year"]


@router.get("/study-hours", response_model=Series)
async def study_hours(user: CurrentUserDep, db: DbDep, range: Range = "week"):
    return await svc.study_hours(db, user, range)


@router.get("/goals-completed", response_model=Series)
async def goals_completed(user: CurrentUserDep, db: DbDep, range: Range = "week"):
    return await svc.goals_completed(db, user, range)


@router.get("/progress", response_model=Progress)
async def progress(user: CurrentUserDep, db: DbDep, period: Literal["weekly", "monthly"] = "weekly"):
    return await svc.progress(db, user, period)
