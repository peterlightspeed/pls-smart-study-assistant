"""Simple in-memory sliding-window limiter, keyed by client IP.
Good enough for a single instance; swap for Redis/slowapi if you scale horizontally."""
import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, per_minute: int):
        super().__init__(app)
        self.per_minute = per_minute
        self.hits: dict[str, deque] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/health" or request.method == "OPTIONS":
            return await call_next(request)
        ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")).split(",")[0].strip()
        now, window = time.monotonic(), self.hits[ip]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= self.per_minute:
            body = {"error": {"code": "rate_limited", "message": "Too many requests. Please slow down.", "details": {}}}
            return JSONResponse(body, 429, headers={"Retry-After": "30"})
        window.append(now)
        if len(self.hits) > 10_000:  # bound memory
            self.hits.clear()
        return await call_next(request)
