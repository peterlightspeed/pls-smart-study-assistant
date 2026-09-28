from fastapi import APIRouter

from app.routes.v1 import analytics, categories, dashboard, gallery, goals, me, notes, study_sessions

api_router = APIRouter()
for module in (me, categories, goals, study_sessions, notes, gallery, dashboard, analytics):
    api_router.include_router(module.router)
