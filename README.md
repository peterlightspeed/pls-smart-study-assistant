# PLS Smart Study Assistant

Mobile-first PWA for goals, study planning, notes, gallery and analytics.
**Stack:** HTML/CSS/JS + Bootstrap 5 (Vercel) · FastAPI (Render/Railway) · Supabase (Postgres + Auth + Storage).

```
frontend/   static PWA, no build step        -> deploy to Vercel (root directory: frontend)
backend/    FastAPI + SQLAlchemy + Alembic   -> deploy to Render/Railway (root directory: backend)
supabase/   SQL that touches the auth schema (RLS, triggers)
```

## Setup

### 1. Supabase
1. Create a project. Note the **Project URL**, the **anon (publishable) key**, and the **Session pooler** connection string (Connect -> Session pooler).
2. Auth -> URL Configuration: set Site URL to your Vercel URL and add `http://localhost:3000` as a redirect URL.

### 2. Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                                    # fill in SUPABASE_URL and DATABASE_URL
alembic upgrade head                                    # creates all tables + seeds categories
pytest -q && ruff check .
uvicorn app.main:app --reload --port 8000               # http://localhost:8000/docs
```
Then run `supabase/sql/001_...sql` and `002_...sql` in the Supabase SQL editor (in that order).
Integration tests need Postgres: `RUN_DB_TESTS=1 pytest` (CI does this automatically).

### 3. Frontend
Edit `frontend/js/core/config.js` (Supabase URL, anon key, deployed API origin), then:
```bash
cd frontend && python -m http.server 3000               # open http://localhost:3000/app.html
```
Add `http://localhost:3000` to `CORS_ORIGINS` in `backend/.env`.

### 4. Verify authenticated `/me`
Create a test user in Supabase (Auth -> Users -> Add user, tick "Auto confirm"), then:
```bash
curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-password"}'      # copy access_token
curl -s http://localhost:8000/api/v1/me -H "Authorization: Bearer <access_token>"
```
A JSON profile means the JWT verification, database connection and profile provisioning all work.

### 5. Deploy
- **Vercel:** import the repo, set Root Directory to `frontend`, no build command.
- **Render:** Root Directory `backend`, build `pip install -r requirements.txt`, start
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, health check path `/health`. Set env vars from `.env.example`
  (with `ENVIRONMENT=production` to hide `/docs`). Run `alembic upgrade head` once from a shell or as a pre-deploy command.

## Conventions
- Routes (HTTP only) -> services (business logic, always scoped by `user_id`) -> models.
- Errors always look like `{"error": {"code", "message", "details"}}`.
- Bump `VERSION` in `frontend/sw.js` whenever precached files change.
