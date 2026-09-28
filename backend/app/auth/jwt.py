"""Verifies Supabase-issued JWTs. The backend never sees passwords.

- New Supabase projects sign with asymmetric keys -> verified via the JWKS endpoint.
- Legacy projects sign with HS256 -> verified with SUPABASE_JWT_SECRET.
"""
from functools import lru_cache

import jwt
from jwt import PyJWKClient

from app.core.config import get_settings
from app.core.errors import UnauthorizedError

ASYMMETRIC_ALGS = ["ES256", "RS256"]


@lru_cache
def _jwks_client(url: str) -> PyJWKClient:
    return PyJWKClient(url, cache_keys=True, lifespan=3600)


def verify_token(token: str) -> dict:
    """Blocking (may fetch JWKS on first use). Call via run_in_threadpool from async code."""
    s = get_settings()
    try:
        alg = jwt.get_unverified_header(token).get("alg")
        if alg == "HS256":
            if not s.supabase_jwt_secret:
                raise UnauthorizedError("invalid_token", "Token algorithm is not accepted.")
            key, algorithms = s.supabase_jwt_secret, ["HS256"]
        else:
            key = _jwks_client(s.jwks_url).get_signing_key_from_jwt(token).key
            algorithms = ASYMMETRIC_ALGS
        return jwt.decode(
            token, key, algorithms=algorithms, audience="authenticated", issuer=s.jwt_issuer,
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError:
        raise UnauthorizedError("token_expired", "Your session has expired. Please sign in again.") from None
    except jwt.PyJWTError:
        raise UnauthorizedError("invalid_token", "Invalid authentication token.") from None
