from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

from fastapi import Depends
from fastapi.concurrency import run_in_threadpool
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.jwt import verify_token
from app.core.errors import UnauthorizedError

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    email: str | None
    full_name: str | None


async def get_current_user(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> CurrentUser:
    if creds is None:
        raise UnauthorizedError("missing_token", "Authorization header is required.")
    claims = await run_in_threadpool(verify_token, creds.credentials)
    meta = claims.get("user_metadata") or {}
    return CurrentUser(id=UUID(claims["sub"]), email=claims.get("email"), full_name=meta.get("full_name"))


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]
