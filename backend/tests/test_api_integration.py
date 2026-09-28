"""End-to-end API tests against a real Postgres. Run with: RUN_DB_TESTS=1 pytest (after `alembic upgrade head`)."""
import os
import time
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app

pytestmark = pytest.mark.skipif(not os.getenv("RUN_DB_TESTS"), reason="needs Postgres (set RUN_DB_TESTS=1)")


def headers(uid: str) -> dict:
    s = get_settings()
    token = jwt.encode({"sub": uid, "aud": "authenticated", "iss": s.jwt_issuer, "exp": int(time.time()) + 600,
                        "user_metadata": {"full_name": "Test User"}}, s.supabase_jwt_secret, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def alice():
    return headers(str(uuid.uuid4()))


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def test_profile_and_settings_autoprovision(client, alice):
    me = client.get("/api/v1/me", headers=alice).json()
    assert me["full_name"] == "Test User" and me["timezone"] == "UTC"
    assert client.patch("/api/v1/me", json={"timezone": "Africa/Lagos"}, headers=alice).json()["timezone"] == "Africa/Lagos"
    st = client.patch("/api/v1/me/settings", json={"theme": "dark", "weekly_study_target_minutes": 300}, headers=alice).json()
    assert st["theme"] == "dark" and st["weekly_study_target_minutes"] == 300
    assert client.patch("/api/v1/me/settings", json={"week_starts_on": 3}, headers=alice).status_code == 422


def test_categories(client, alice):
    cats = client.get("/api/v1/categories", headers=alice).json()
    assert {"Academic", "Coding", "Health"} <= {c["name"] for c in cats}
    mine = client.post("/api/v1/categories", json={"name": "Languages", "color": "#112233"}, headers=alice)
    assert mine.status_code == 201
    assert client.post("/api/v1/categories", json={"name": "Languages"}, headers=alice).status_code == 409
    default_id = next(c["id"] for c in cats if c["is_default"])
    assert client.delete(f"/api/v1/categories/{default_id}", headers=alice).status_code == 404  # defaults are read-only
    assert client.delete(f"/api/v1/categories/{mine.json()['id']}", headers=alice).status_code == 204


def test_goal_lifecycle_filters_and_dashboard(client, alice):
    due = datetime.now(timezone.utc) + timedelta(days=2)
    g = client.post("/api/v1/goals", json={"title": "Physics assignment", "priority": "high", "scope": "weekly", "due_at": iso(due)}, headers=alice)
    assert g.status_code == 201, g.text
    gid = g.json()["id"]
    client.post("/api/v1/goals", json={"title": "Read chapter 4"}, headers=alice)

    assert len(client.get("/api/v1/goals", headers=alice).json()) == 2
    assert [x["title"] for x in client.get("/api/v1/goals?q=physics", headers=alice).json()] == ["Physics assignment"]
    assert client.get("/api/v1/goals?priority=high", headers=alice).json()[0]["id"] == gid
    assert client.post("/api/v1/goals", json={"title": "  "}, headers=alice).status_code == 422
    assert client.post("/api/v1/goals", json={"title": "x", "category_id": str(uuid.uuid4())}, headers=alice).status_code == 422

    assert client.patch(f"/api/v1/goals/{gid}", json={"title": "Physics lab"}, headers=alice).json()["title"] == "Physics lab"
    done = client.post(f"/api/v1/goals/{gid}/complete", headers=alice).json()
    assert done["status"] == "completed" and done["completed_at"]

    dash = client.get("/api/v1/dashboard/summary", headers=alice).json()
    assert dash["completed_today"] == 1 and dash["streak_days"] == 1
    assert dash["weekly_goals"]["total"] >= 1 and 0 <= dash["productivity_score"] <= 100

    assert client.post(f"/api/v1/goals/{gid}/reopen", headers=alice).json()["status"] == "active"
    assert client.delete(f"/api/v1/goals/{gid}", headers=alice).status_code == 204
    assert client.get(f"/api/v1/goals/{gid}", headers=alice).json()["error"]["code"] == "goal_not_found"


def test_users_cannot_see_each_others_data(client, alice):
    bob = headers(str(uuid.uuid4()))
    gid = client.post("/api/v1/goals", json={"title": "Secret"}, headers=alice).json()["id"]
    nid = client.post("/api/v1/notes", json={"title": "Diary", "content": {"ops": [{"insert": "private\n"}]}}, headers=alice).json()["id"]
    assert client.get(f"/api/v1/goals/{gid}", headers=bob).status_code == 404
    assert client.delete(f"/api/v1/goals/{gid}", headers=bob).status_code == 404
    assert client.post(f"/api/v1/goals/{gid}/complete", headers=bob).status_code == 404
    assert client.get(f"/api/v1/notes/{nid}", headers=bob).status_code == 404
    assert client.get("/api/v1/goals", headers=bob).json() == []
    assert client.get("/api/v1/notes?q=private", headers=bob).json() == []


def test_study_session_flow_calendar_and_analytics(client, alice):
    start = datetime.now(timezone.utc) + timedelta(hours=1)
    s = client.post("/api/v1/study-sessions", json={"title": "Calculus", "scheduled_start": iso(start), "planned_minutes": 90}, headers=alice)
    assert s.status_code == 201, s.text
    sid = s.json()["id"]
    assert client.post(f"/api/v1/study-sessions/{sid}/start", headers=alice).json()["status"] == "in_progress"
    assert client.post(f"/api/v1/study-sessions/{sid}/start", headers=alice).status_code == 409
    done = client.post(f"/api/v1/study-sessions/{sid}/complete", json={"actual_minutes": 75}, headers=alice).json()
    assert done["status"] == "completed" and done["actual_minutes"] == 75
    assert client.post(f"/api/v1/study-sessions/{sid}/skip", headers=alice).status_code == 409

    cal = client.get("/api/v1/calendar", params={"from": iso(start - timedelta(days=1)), "to": iso(start + timedelta(days=1))}, headers=alice).json()
    assert [x["id"] for x in cal["sessions"]] == [sid]
    assert client.get("/api/v1/calendar", params={"from": iso(start), "to": iso(start + timedelta(days=400))}, headers=alice).status_code == 422

    hours = client.get("/api/v1/analytics/study-hours?range=week", headers=alice).json()
    assert len(hours["labels"]) == 7 and round(sum(hours["values"]), 2) == 1.25
    assert len(client.get("/api/v1/analytics/study-hours?range=year", headers=alice).json()["labels"]) == 12
    assert len(client.get("/api/v1/analytics/study-hours?range=month", headers=alice).json()["labels"]) == 30
    weekly = client.get("/api/v1/analytics/progress?period=weekly", headers=alice).json()
    assert len(weekly["score"]) == 8 and weekly["score"][-1] > 0
    monthly = client.get("/api/v1/analytics/progress?period=monthly", headers=alice).json()
    assert monthly["score"] is None and len(monthly["labels"]) == 6
    assert len(client.get("/api/v1/analytics/goals-completed?range=week", headers=alice).json()["values"]) == 7


def test_notes_roundtrip_search_and_pin(client, alice):
    delta = {"ops": [{"insert": "Key formulas"}, {"insert": "\n", "attributes": {"header": 1}},
                     {"insert": "v = f\u03bb"}, {"insert": "\n", "attributes": {"list": "bullet"}}]}
    n = client.post("/api/v1/notes", json={"title": "Physics - Waves", "content": delta}, headers=alice)
    assert n.status_code == 201, n.text
    nid = n.json()["id"]
    assert client.get(f"/api/v1/notes/{nid}", headers=alice).json()["content"] == delta   # formatting round-trips
    assert client.get("/api/v1/notes?q=formulas", headers=alice).json()[0]["id"] == nid       # body search works
    assert client.patch(f"/api/v1/notes/{nid}", json={"is_pinned": True}, headers=alice).json()["is_pinned"] is True
    assert client.post("/api/v1/notes", json={"content": {"nope": 1}}, headers=alice).status_code == 422
    assert client.delete(f"/api/v1/notes/{nid}", headers=alice).status_code == 204


def test_gallery_reports_missing_storage_config(client, alice):
    from io import BytesIO

    from PIL import Image
    buf = BytesIO()
    Image.new("RGB", (50, 50)).save(buf, "PNG")
    r = client.post("/api/v1/gallery", data={"title": "Cert", "item_type": "certificate"}, files={"file": ("c.png", buf.getvalue(), "image/png")}, headers=alice)
    assert r.status_code == 503 and r.json()["error"]["code"] == "storage_not_configured"
    bad = client.post("/api/v1/gallery", data={"title": "x"}, files={"file": ("c.png", b"nope", "image/png")}, headers=alice)
    assert bad.status_code == 415
