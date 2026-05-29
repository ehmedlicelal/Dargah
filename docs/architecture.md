# Nərimanov Digital — System Architecture

## Overview

**Nərimanov Digital** is the official Digital Monitoring & Smart Services Platform for Nərimanov District, Baku, Azerbaijan.

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER / CLIENT                         │
│              Next.js 15 App (Vercel)                           │
│         localhost:3000  →  narimanov.vercel.app                │
└──────────────────────────────┬──────────────────────────────────┘
                               │  HTTPS (REST + Realtime WS)
          ┌────────────────────┴──────────────────┐
          │                                       │
          ▼                                       ▼
┌──────────────────┐                   ┌──────────────────────┐
│  Next.js API     │  HTTP (Bearer JWT)│   Supabase           │
│  Route Handlers  │──────────────────▶│   - PostgreSQL       │
│  (BFF layer)     │                   │   - Auth (JWT)       │
│  /api/*          │                   │   - Storage          │
└────────┬─────────┘                   │   - Realtime WS      │
         │  HTTP                       └──────────────────────┘
         │  Bearer JWT
         ▼
┌──────────────────────────────────────────┐
│  FastAPI Backend (Render)                │
│  localhost:8000  →  api.onrender.com     │
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ routers/ │  │  crud/   │  │services│ │
│  └──────────┘  └──────────┘  └───┬────┘ │
│                                  │      │
└──────────────────────────────────┼──────┘
                                   │  HTTPS (OpenRouter API)
                                   ▼
                        ┌──────────────────────┐
                        │  OpenRouter AI        │
                        │  (Mistral / GPT-4o)  │
                        │  openrouter.ai       │
                        └──────────────────────┘
```

---

## Auth Flow

```
1. User visits /auth/login
2. Submits email + password
3. Frontend calls supabase.auth.signInWithPassword()
4. Supabase returns { access_token, refresh_token, user }
5. @supabase/ssr stores session in cookies (HttpOnly)
6. On protected pages, Next.js API routes read cookie → extract JWT
7. API route forwards request to FastAPI with:
   Authorization: Bearer <access_token>
8. FastAPI calls supabase.auth.get_user(token) to validate
9. Returns UserProfile or 401 Unauthorized
```

**ASAN eID placeholder:** Button exists in login UI but is disabled pending official ASAN OAuth credentials from the district authority.

---

## Realtime Flow (Live Monitoring)

```
1. /monitoring page loads (Client Component)
2. Creates Supabase Realtime channel:
   supabase.channel('monitoring-live')
     .on('postgres_changes', {
       event: 'INSERT',
       schema: 'public',
       table: 'monitoring_data'
     }, (payload) => updateState(payload.new))
     .subscribe()
3. When a sensor/operator inserts a new row into monitoring_data:
   Supabase broadcasts the INSERT event to all subscribed clients
4. React state updates → MonitoringCard re-renders without page refresh
5. On component unmount: supabase.removeChannel(channel)
```

Tables enabled for Realtime: `monitoring_data`, `complaints`

---

## OpenRouter AI Flow (Complaint Classification)

```
1. Citizen submits complaint via POST /complaints/
2. FastAPI creates the complaint row in Supabase
3. FastAPI calls ai_service.classify_complaint(title, description)
4. ai_service builds prompt:
   "Bu şikayəti analiz et və JSON formatında cavab ver..."
5. Sends to OpenRouter /chat/completions
   Model: mistralai/mistral-7b-instruct (cheap, fast)
6. Parses response → { category, priority, summary }
7. Updates complaint row with AI classification
8. Returns enriched ComplaintRead to client
```

**Graceful degradation:** If OpenRouter is unavailable or returns malformed JSON:
- `category` defaults to `"other"`
- `priority` defaults to `"medium"`
- `ai_summary` stays `null`
- Complaint creation always succeeds

---

## Database Schema Summary

```
auth.users (Supabase managed)
    └── users (extends auth.users)
            ├── district_zones
            │       └── monitoring_data
            │       └── complaints
            │       └── services
            └── complaints (user_id FK)
open_data_reports (standalone)
```

See `supabase/schema.sql` for full DDL with RLS policies.

---

## Environment Variables

### Frontend (`frontend/.env.local`)
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key (safe for browser) |
| `NEXT_PUBLIC_BACKEND_URL` | FastAPI base URL (e.g. `http://localhost:8000`) |
| `NEXT_PUBLIC_MAP_TILE_URL` | OpenStreetMap tile URL for Leaflet |

### Backend (`backend/.env`)
| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (never expose to browser) |
| `SUPABASE_ANON_KEY` | Anon key (used for auth validation) |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |
| `OPENROUTER_MODEL` | e.g. `mistralai/mistral-7b-instruct` |
| `FRONTEND_URL` | Frontend origin for CORS |
| `ENVIRONMENT` | `development` or `production` |

---

## Local Development

### Prerequisites
- Node.js 20+
- Python 3.14+
- Supabase account + project
- OpenRouter account + API key

### Start Backend
```bash
cd backend
cp .env.example .env      # fill in your values
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# Swagger UI: http://localhost:8000/docs
```

### Start Frontend
```bash
cd frontend
cp .env.local.example .env.local   # fill in your values
npm install
npm run dev
# App: http://localhost:3000
```

### Setup Database
1. Go to your Supabase project dashboard → SQL Editor
2. Run `supabase/schema.sql` (creates all tables, RLS, indexes, realtime)
3. Run `supabase/seed.sql` (inserts sample data for development)

---

## Deployment

### Frontend → Vercel
1. Push repo to GitHub
2. Import project in Vercel
3. Set **Root Directory** to `frontend`
4. Add environment variables in Vercel dashboard
5. Deploy — Vercel auto-deploys on push to `main`

### Backend → Render
1. Create new **Web Service** in Render
2. Connect GitHub repo, set **Root Directory** to `backend`
3. Set **Dockerfile** as build method
4. Add environment variables in Render dashboard
5. Set `FRONTEND_URL` to your Vercel production URL
6. Deploy

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Two Supabase clients | Backend uses service key (bypasses RLS — trusted). Frontend uses anon key (enforces RLS). |
| BFF API Routes | Browser never calls Render directly. Next.js `/api/*` routes inject JWT and hide backend URL. |
| Pydantic v2 | Required for FastAPI ≥ 0.100 and provides better performance + validation. |
| `@supabase/ssr` | Handles cookie-based sessions in Next.js App Router correctly (replaces deprecated `@supabase/auth-helpers-nextjs`). |
| OpenRouter over OpenAI direct | Single API key for multiple model providers; easy model swapping; cost optimization. |
| Tailwind only, no component library | Client requirement — UI will be custom-designed later; skeleton uses plain utility classes. |
