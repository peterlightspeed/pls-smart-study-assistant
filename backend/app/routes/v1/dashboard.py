from fastapi import APIRouter

from app.auth.dependencies import CurrentUserDep
from app.database.session import DbDep
from app.schemas.insights import DashboardSummary
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def summary(user: CurrentUserDep, db: DbDep):
    return await dashboard_service.summary(db, user)
