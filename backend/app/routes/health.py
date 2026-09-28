from fastapi import APIRouter

router = APIRouter(tags=["system"])


@router.get("/health")
async def health() -> dict:
    """Unauthenticated liveness probe (used by Render/Railway and the frontend status card)."""
    return {"status": "ok"}
