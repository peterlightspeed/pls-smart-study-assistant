"""Supabase Storage + Auth-admin REST calls using the service-role key (server-side only)."""
import httpx

from app.core.config import get_settings
from app.core.errors import AppError


def _cfg():
    s = get_settings()
    if not s.supabase_service_role_key:
        raise AppError(503, "storage_not_configured", "File storage isn't configured on the server.")
    base = s.supabase_url.rstrip("/")
    headers = {"Authorization": f"Bearer {s.supabase_service_role_key}", "apikey": s.supabase_service_role_key}
    return s, base, headers


async def upload(path: str, data: bytes, content_type: str = "image/webp") -> None:
    s, base, headers = _cfg()
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{base}/storage/v1/object/{s.storage_bucket}/{path}", content=data,
                         headers={**headers, "Content-Type": content_type, "x-upsert": "false"})
    if r.status_code >= 400:
        raise AppError(502, "storage_upload_failed", "Couldn't store the file. Please try again.")


async def remove(paths: list[str]) -> None:
    if not paths:
        return
    s, base, headers = _cfg()
    async with httpx.AsyncClient(timeout=30) as c:
        await c.request("DELETE", f"{base}/storage/v1/object/{s.storage_bucket}", json={"prefixes": paths}, headers=headers)


async def sign_many(paths: list[str], expires_in: int = 3600) -> dict[str, str]:
    """Returns {path: absolute signed url}. Missing/failed paths are omitted."""
    if not paths:
        return {}
    s, base, headers = _cfg()
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{base}/storage/v1/object/sign/{s.storage_bucket}", json={"expiresIn": expires_in, "paths": paths}, headers=headers)
    if r.status_code >= 400:
        return {}
    return {i["path"]: f"{base}/storage/v1{i['signedURL']}" for i in r.json() if i.get("signedURL")}


async def delete_auth_user(user_id: str) -> None:
    _, base, headers = _cfg()
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.delete(f"{base}/auth/v1/admin/users/{user_id}", headers=headers)
    if r.status_code >= 400 and r.status_code != 404:
        raise AppError(502, "account_delete_failed", "Couldn't delete the account. Please try again.")
