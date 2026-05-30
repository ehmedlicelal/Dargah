# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project overview

**Nərimanov Digital** — official Digital Monitoring & Smart Services Platform for Nərimanov District, Baku, Azerbaijan. Monorepo with a Next.js 15 frontend, FastAPI backend, Supabase database, and OpenRouter AI.

All user-facing text is in Azerbaijani.

---

## Development commands

### Frontend
```bash
cd frontend
npm install          # first time only
npm run dev          # http://localhost:3000
npm run build        # production build
npm run lint         # ESLint
```

### Backend
```bash
cd backend
pip install -r requirements.txt   # first time only
python -m uvicorn main:app --reload --port 8000   # http://localhost:8000
# Swagger UI: http://localhost:8000/docs
```

No test suite is configured yet.

---

## Environment setup

Both services need `.env` files created from their examples before they will start:

- `backend/.env` from `backend/.env.example`
- `frontend/.env.local` from `frontend/.env.local.example`

Required backend vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY`, `OPENROUTER_API_KEY`.  
Required frontend vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.  
Optional: `WATI_API_URL` / `WATI_API_TOKEN` (WhatsApp webhook integration).

---

## Architecture

### Data flow

```
Browser → Next.js middleware (JWT check) → React page
                                                ↓
                              lib/api.ts (fetch → FastAPI)   or
                              lib/supabase.ts (direct Supabase)
                                                ↓
                                         FastAPI routers
                                                ↓
                                       crud/ → supabase-py (service key)
                                                ↓
                                    services/ai_service.py → OpenRouter
```

### Frontend (`frontend/`)

**`lib/api.ts`** — single API facade for all FastAPI calls. Every function here wraps `apiFetch()` which reads `NEXT_PUBLIC_BACKEND_URL`. Exception: `createComplaint()` writes directly to Supabase via the browser client (to capture the authenticated `user_id`).

**`lib/supabase.ts`** — browser-side Supabase client (`createBrowserClient`). Used for auth and for the direct-Supabase complaint insert.

**`lib/types.ts`** — canonical TypeScript types for all shared models.

**`hooks/useUser.ts`** — fetches auth user + `users` table profile row; exposes `isAdmin`, `isOperator`, `isStaff`, `isCitizen` booleans. Subscribes to `onAuthStateChange`.

**`middleware.ts`** — runs on every non-static request. Protects `/admin`, `/dashboard`, `/complaints`, `/citizen`. Redirects unauthenticated users to `/auth/login?next=<path>`. Role-level checks (admin vs citizen) are NOT done here — they're delegated to `RoleGuard`.

**`components/RoleGuard.tsx`** — client component wrapping a page's content. Reads `useUser()` and redirects wrong-role users to `/unauthorized`. Wrap all admin/operator pages with `<RoleGuard roles={["admin","operator"]}>`.

**`app/admin/page.tsx`** — immediately redirects to `/dashboard`. The real dashboard is at `app/dashboard/page.tsx`.

### Backend (`backend/`)

**`main.py`** — FastAPI entry point. Registers all routers, CORS (allows `FRONTEND_URL` + `localhost:3000`), and `slowapi` rate limiting (100 req/min by default).

**`core/config.py`** — Pydantic `Settings` loaded from `backend/.env`. Import as `from core.config import settings`.

**`core/supabase_client.py`** — singleton `get_supabase()` dependency. Uses the **service role key** — it bypasses RLS. All backend DB access goes through this.

**`core/openrouter_client.py`** — `openrouter_chat(messages, model, ...)` async wrapper around OpenRouter's chat completions API.

**`services/ai_service.py`** — three AI functions:
- `classify_complaint(title, description)` — returns `{category, priority, ai_summary}`.
- `analyze_complaint_with_image(title, description, image_url?)` — same but adds `reasoning`; uses vision model when `image_url` is set.
- `generate_official_report(...)` — produces a structured Azerbaijani government report (Markdown).  
  All functions return safe hardcoded defaults if OpenRouter fails — never raise.

**Router pattern:** every router in `routers/` takes a `supabase: Client = Depends(get_supabase)` dependency and delegates DB work to the matching function in `crud/`.

### AI models

Configured in `backend/.env` / `core/config.py`:
- `OPENROUTER_MODEL` — text model (default `google/gemini-2.0-flash-001`).
- `OPENROUTER_VISION_MODEL` — vision model for image-included requests (also `google/gemini-2.0-flash-001`).

### Role system

Three roles stored in the `users` Supabase table:
- `citizen` — can submit complaints, view own complaints.
- `operator` — same as citizen + can update complaint status/priority/category.
- `admin` — full access including user management.

`/dashboard` requires `admin` or `operator` (enforced by `RoleGuard`).

### Map component

`frontend/components/NarimanovMap.tsx` — wraps the 2GIS MapGL JS API (loaded dynamically). Uses `@turf/turf` for exact polygon-boundary scoped search — results outside the Nərimanov district polygon are filtered out. The polygon boundary is defined inline as a GeoJSON Feature.

### Complaint lifecycle

1. Citizen submits via the dashboard "Yeni Müraciət" tab → `createComplaint()` inserts directly to Supabase.
2. After insert, the frontend calls `updateComplaint()` via FastAPI to apply AI category from the live `analyzeComplaint()` response.
3. Operators change `status` / `priority` / `category` and optionally direct to a `Service` — stored as JSON in `report_content`.
4. AI-generated official report can be triggered per complaint via `POST /reports/generate`.

---

## Key conventions

- **Azerbaijani text everywhere** in labels, error messages, and AI prompts.
- **AI calls never throw** — `ai_service.py` functions catch all exceptions and return `_DEFAULT_CLASSIFICATION`.
- **Backend uses service key** (bypasses RLS). Frontend uses anon key (RLS applies).
- **Tailwind only** — no component libraries. Material Symbols icons via CDN (`material-symbols-outlined` class).
- **No Leaflet** — the project switched to 2GIS MapGL. Do not add `react-leaflet`.
- `report_content` on complaints stores JSON when a service is directed: `{directed_service_id, directed_service_name}`.
