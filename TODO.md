# TODO: things only YOU can do

The app (backend + frontend) is fully built and tested on my side: 29 backend tests pass
against a real Postgres database, and every frontend module parses cleanly. What's left is
account creation, secrets, and deployment — things I can't do for you. Follow this top to
bottom; each section says exactly what to click and what to paste.

---

## 0. Before you touch anything: check for your old project

If you can still log into your **old Supabase project** or **old Vercel/Render dashboard**,
check first:
- [ ] Does the old Supabase project still exist? (Project Settings → General). If yes, note
      its URL — we may reuse it instead of creating a new one, so your old users/data survive.
- [ ] Does the old Vercel deployment still exist? Sometimes the *deployment* survives even if
      the *source code* is lost, and you can download the built files from its dashboard.
- [ ] Check your GitHub account for a repo you forgot about (search your username + "study").

**Tell me if any of these exist before you go further** — I'll adjust the schema/migration
so we don't wipe out real data.

If none of this exists (clean slate), continue below.

---

## 1. Accounts you need (10 min)

- [ ] **GitHub** — github.com (you probably have this already)
- [ ] **Supabase** — supabase.com → "Start your project" (free tier is fine to start)
- [ ] **Vercel** — vercel.com → sign up with GitHub
- [ ] **Render** — render.com → sign up with GitHub (or Railway, if you prefer — see note in §6)

---

## 2. Create the Supabase project (10 min)

1. [ ] Supabase dashboard → **New project**.
   - Name: `pls-smart-study-assistant` (or anything).
   - Database password: **generate a strong one and save it in a password manager** — you'll
     need it once, for `DATABASE_URL`.
   - Region: pick the one closest to your users (e.g. a region near Lagos if that's your
     primary audience).
2. [ ] Wait ~2 minutes for provisioning.
3. [ ] Go to **Project Settings → Data API** (older UIs: "Settings → API") and copy:
   - **Project URL** → looks like `https://xxxxxxxx.supabase.co`
   - **anon / public key** → long JWT string (safe to expose in frontend code)
   - **service_role key** → long JWT string — **SECRET. Backend-only. Never in frontend code,
     never committed to git.**
4. [ ] Go to **Project Settings → Database → Connection string → Session pooler** and copy
   that URL (it will look like
   `postgresql://postgres.xxxxxxxx:[YOUR-PASSWORD]@aws-0-region.pooler.supabase.com:5432/postgres`).
   Replace `[YOUR-PASSWORD]` with the database password from step 1.
5. [ ] Go to **Authentication → URL Configuration**:
   - Site URL: leave as `http://localhost:3000` for now — you'll update it after Vercel gives
     you a real URL (§7).
   - Redirect URLs: add `http://localhost:3000/*` (you'll add the Vercel one later).
6. [ ] Go to **Authentication → Emails** and confirm "Confirm email" is **ON** (it is by
   default) — this is what makes the email-verification flow in the app actually happen.

**Where each value is used:**

| Value | Goes into |
|---|---|
| Project URL | `backend/.env` → `SUPABASE_URL`, and `frontend/js/core/config.js` → `SUPABASE_URL` |
| anon key | `frontend/js/core/config.js` → `SUPABASE_ANON_KEY` only |
| service_role key | `backend/.env` (local) and Render's environment variables (deployed) → `SUPABASE_SERVICE_ROLE_KEY`. **Never** put this in any frontend file. |
| Session pooler URL | `backend/.env` → `DATABASE_URL`, and Render's environment variables |

---

## 3. Run the database migration + SQL (10 min)

Do this **locally first** (you need Python 3.12 installed):

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows (PowerShell): .venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
cp .env.example .env
```

- [ ] Open `backend/.env` and fill in real values for `SUPABASE_URL` and `DATABASE_URL`
      (leave `SUPABASE_JWT_SECRET` blank — new Supabase projects don't need it;
      fill in `SUPABASE_SERVICE_ROLE_KEY` too, it's needed for Gallery uploads).

```bash
alembic upgrade head                 # creates all tables + seeds the 6 default categories
RUN_DB_TESTS=1 pytest -q             # optional: runs the full integration suite against your DB
```

- [ ] In the **Supabase SQL Editor** (left sidebar), paste and run, **in this exact order**:
  1. `supabase/sql/001_profiles_auth_hooks.sql`
  2. `supabase/sql/002_rls_storage_triggers.sql`
- [ ] Check **Storage** in the sidebar: you should now see a private bucket named `gallery`.
- [ ] Check **Table Editor**: you should see `categories` pre-filled with Academic, Personal,
      Coding, Health, Career, Study Planner.

---

## 4. Wire up the frontend locally (5 min)

- [ ] Open `frontend/js/core/config.js` and replace the placeholders:

```js
export const CONFIG = Object.freeze({
  API_ORIGIN: isLocal ? "http://localhost:8000" : "https://YOUR-BACKEND.onrender.com", // update after §6
  API_PREFIX: "/api/v1",
  SUPABASE_URL: "https://xxxxxxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJ...your anon key...",
});
```

- [ ] Run the backend: `uvicorn app.main:app --reload --port 8000` (from `backend/`, venv active).
- [ ] Run the frontend: `cd frontend && python -m http.server 3000`, open
      `http://localhost:3000/app.html`.
- [ ] Add `http://localhost:3000` to `CORS_ORIGINS` in `backend/.env` (it's a JSON list, e.g.
      `CORS_ORIGINS=["http://localhost:3000"]`) and restart uvicorn.
- [ ] Sign up with a real email you can check. Confirm you get a verification email, click it,
      and land on the dashboard.

---

## 5. Git: get the code onto GitHub

**Everything below is safe** — the `.gitignore` I added already excludes `.env`, `.venv/`,
`__pycache__/`, and anything named like a key or certificate. `git status` should **never**
show `.env` as a file to be committed. If it ever does, stop and check before committing.

```bash
cd pls-smart-study-assistant        # the folder this zip extracts to (rename as you like)
git init
git add .
git status                          # sanity check: .env should NOT appear in this list
git commit -m "Initial commit: PLS Smart Study Assistant (backend + PWA frontend)"
```

- [ ] Create a **new, empty** repository on GitHub (do **not** initialize it with a README —
      you already have one). Name suggestion: `pls-smart-study-assistant`.
- [ ] Copy the remote URL GitHub shows you, then:

```bash
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/pls-smart-study-assistant.git
git push -u origin main
```

**Commit message convention** for future changes (keeps history readable):
```
feat: add study session skip action
fix: goal deadline timezone off-by-one
chore: bump sw.js cache version
docs: update README setup steps
```

**Every time you change frontend static files** (anything under `frontend/`), run this first
so the service worker caches the new file list, then commit both:
```bash
python tools/update_precache.py     # regenerates the PRECACHE list in frontend/sw.js
# then open frontend/sw.js and bump: const VERSION = "v3";  (increment by 1)
git add frontend/sw.js
git commit -m "chore: bump sw.js cache version"
git push
```

---

## 6. Deploy the backend to Render (15 min)

1. [ ] Render dashboard → **New → Web Service** → connect your GitHub repo.
2. [ ] Settings:
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/health`
   - **Instance Type**: Free is fine to test, but see the note below about sleeping.
3. [ ] **Environment** tab → add these variables (values from §2):

   | Key | Value |
   |---|---|
   | `ENVIRONMENT` | `production` |
   | `DATABASE_URL` | your Supabase session-pooler URL (with real password) |
   | `SUPABASE_URL` | your Supabase project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service_role key |
   | `CORS_ORIGINS` | `["https://YOUR-APP.vercel.app"]` (you'll get this URL in §7 — update this variable afterwards and it will auto-redeploy) |
   | `STORAGE_BUCKET` | `gallery` |

4. [ ] Deploy. Once live, open `https://YOUR-BACKEND.onrender.com/health` in a browser — you
       should see `{"status":"ok"}`.
5. [ ] Run the migration against the **production** database once (from your machine, with
       production `DATABASE_URL` temporarily exported):
   ```bash
   cd backend
   DATABASE_URL="<production pooler URL>" alembic upgrade head
   ```
   (You already ran the Supabase SQL files in §3 — those don't need to be re-run per
   environment, since they ran directly against your one Supabase project.)

**⚠️ Free-tier note:** Render's free instances sleep after inactivity and take 30–60s to wake
on the next request — that's exactly why the dashboard shows a "waking the server up…"
status. For a real launch, upgrade to a paid instance (Starter plan) so students don't hit a
slow first load.

**If you'd rather use Railway instead:** same environment variables, Root Directory
`backend`, Start Command identical, but set the Healthcheck Path to `/health` in Railway's
settings — Railway auto-detects the build command from `requirements.txt`.

---

## 7. Deploy the frontend to Vercel (10 min)

1. [ ] Update `frontend/js/core/config.js`'s `API_ORIGIN` to your real Render URL from §6,
       commit and push (see §5's commit convention).
2. [ ] Vercel dashboard → **Add New → Project** → import the same GitHub repo.
3. [ ] Settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: "Other" (no build step — this is a static site)
   - **Build Command**: leave empty
   - **Output Directory**: leave as default (`.`)
4. [ ] Deploy. Vercel gives you a URL like `https://pls-smart-study-assistant.vercel.app`.
5. [ ] Go back to **Supabase → Authentication → URL Configuration** and update:
   - Site URL: `https://pls-smart-study-assistant.vercel.app`
   - Redirect URLs: add `https://pls-smart-study-assistant.vercel.app/*`
6. [ ] Go back to **Render → Environment** and update `CORS_ORIGINS` to
       `["https://pls-smart-study-assistant.vercel.app"]` (this triggers an auto-redeploy).
7. [ ] Open the Vercel URL on your phone, sign up with a real email, verify it, and confirm
       the dashboard loads. Try "Add to Home Screen" to confirm the PWA installs.

**Custom domain (optional):** Vercel → Project → Settings → Domains → add yours, follow its
DNS instructions. If you do this, add the custom domain to Supabase's Site URL/Redirect URLs
and to Render's `CORS_ORIGINS` too — all three must agree or login will silently fail with a
CORS or redirect error.

---

## 8. Final checks before you call it launched

- [ ] Sign up as a brand-new user end to end on the **deployed** (not local) URLs: signup →
      verify email → login → create a goal → complete it → see it on the dashboard.
- [ ] Test "Forgot password" end to end with a real inbox.
- [ ] Upload a photo in Gallery and confirm it appears compressed (check the size shown).
- [ ] Turn on airplane mode after the app has loaded once: the shell should still open (empty
      states are fine — full offline writes are a later milestone, see below).
- [ ] Check `RUN_DB_TESTS=1 pytest -q` passes in GitHub Actions (Settings → Actions tab on
      your repo, after your first push — it runs automatically via `.github/workflows/ci.yml`).

## 9. Known gaps (not blockers, just be aware)

- **Push notifications when the app/browser is fully closed** are not implemented — the
  in-app reminder only fires while the app is open. True background push needs a small
  server-side scheduled job (e.g. a Render Cron Job hitting a new endpoint); ask me if you
  want this built next.
- **iOS splash screens**: Android builds its splash from `manifest.webmanifest` automatically;
  iOS needs separate `<link rel="apple-touch-startup-image">` images per device size if you
  want a fully custom splash there. Currently iOS shows a plain white splash then the app.
- **Offline writes**: reads are cached and shown when offline; writes (new goals, sessions,
  notes) queue locally and sync automatically when you're back online, but a hard-refresh
  while offline will lose anything not yet synced. Treat this as "resilient to short network
  blips," not full offline-first.

## 10. Secrets safety checklist (re-check before every push)

- [ ] `git status` never shows `.env`, `.env.local`, or any `*.key`/`*.pem` file.
- [ ] The `SUPABASE_SERVICE_ROLE_KEY` only ever appears in Render's/Railway's environment
      variables panel — grep your frontend folder for it before pushing if you're ever unsure:
      `grep -r "service_role" frontend/` should return nothing.
- [ ] If you ever accidentally paste a real secret into a chat, commit, or public issue,
      rotate it immediately: Supabase → Project Settings → API → "Reset" next to that key.
