import time
import uuid

import jwt
import pytest
from fastapi.testclient import TestClient

from app.auth.jwt import verify_token
from app.core.config import get_settings
from app.core.errors import UnauthorizedError
from app.main import app

client = TestClient(app)


def make_token(**overrides) -> str:
    s = get_settings()
    claims = {"sub": str(uuid.uuid4()), "aud": "authenticated", "iss": s.jwt_issuer, "exp": int(time.time()) + 300}
    claims.update(overrides)
    return jwt.encode(claims, s.supabase_jwt_secret, algorithm="HS256")


def test_health_is_public():
    r = client.get("/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}
    assert "x-request-id" in r.headers


def test_me_requires_token_and_uses_error_envelope():
    r = client.get("/api/v1/me")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "missing_token"


def test_me_rejects_garbage_token():
    r = client.get("/api/v1/me", headers={"Authorization": "Bearer nope"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "invalid_token"


def test_verify_token_accepts_valid_token():
    assert verify_token(make_token(sub="abc"))["sub"] == "abc"


@pytest.mark.parametrize(
    "overrides,code",
    [({"exp": int(time.time()) - 10}, "token_expired"), ({"aud": "other"}, "invalid_token"), ({"iss": "evil"}, "invalid_token")],
)
def test_verify_token_rejects_bad_claims(overrides, code):
    with pytest.raises(UnauthorizedError) as exc:
        verify_token(make_token(**overrides))
    assert exc.value.code == code


def test_database_url_is_normalised_for_asyncpg():
    assert get_settings().database_url.startswith("postgresql+asyncpg://")
