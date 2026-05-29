# Nərimanov Digital

**Nərimanov rayonunun rəsmi rəqəmsal monitorinq və smart xidmət platforması.**  
Official Digital Monitoring & Smart Services Platform for Nərimanov District, Baku, Azerbaijan.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| Backend | Python 3.14 + FastAPI |
| Database | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| AI | OpenRouter (complaint classification, report summarization) |
| Deployment | Vercel (frontend) + Render (backend) |

---

## Project Structure

```
CityFix/
├── frontend/               Next.js 15 App Router
│   ├── app/
│   │   ├── page.tsx        Homepage
│   │   ├── monitoring/     Live monitoring dashboard
│   │   ├── services/       District services
│   │   ├── map/            Interactive map (Leaflet placeholder)
│   │   ├── complaints/     Citizen complaints (submit + track)
│   │   ├── admin/          Admin dashboard
│   │   ├── auth/           Login + OAuth callback
│   │   └── api/            BFF route handlers → FastAPI
│   ├── components/         Shared React components
│   ├── lib/                Supabase client, API helpers, types
│   └── .env.local.example
├── backend/                FastAPI application
│   ├── main.py             Entry point
│   ├── core/               Config, Supabase client, OpenRouter client
│   ├── routers/            API route handlers
│   ├── schemas/            Pydantic v2 models
│   ├── services/           AI service (OpenRouter)
│   ├── crud/               Database operations
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── supabase/
│   ├── schema.sql          Tables, RLS policies, indexes, realtime
│   └── seed.sql            Sample data (zones, monitoring, services)
├── docs/
│   └── architecture.md     System architecture & diagrams
└── README.md
```

---

## Prerequisites

- Node.js 20+
- Python 3.14+
- [Supabase](https://supabase.com) project (free tier works)
- [OpenRouter](https://openrouter.ai) account + API key

---

## Local Setup

### 1. Database (Supabase)

1. Create a Supabase project at supabase.com
2. Go to **SQL Editor** in the dashboard
3. Run `supabase/schema.sql` (creates all tables, RLS policies, realtime, indexes)
4. Run `supabase/seed.sql` (inserts sample district zones, monitoring data, services)
5. Copy your **Project URL** and **API keys** from **Settings → API**

### 2. Backend (FastAPI)

```bash
cd backend
cp .env.example .env
# Edit .env — fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY, OPENROUTER_API_KEY

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs available at: `http://localhost:8000/docs`

### 3. Frontend (Next.js)

```bash
cd frontend
cp .env.local.example .env.local
# Edit .env.local — fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

npm install
npm run dev
```

App available at: `http://localhost:3000`

---

## Environment Variables

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `NEXT_PUBLIC_BACKEND_URL` | FastAPI base URL (default: `http://localhost:8000`) |
| `NEXT_PUBLIC_MAP_TILE_URL` | Map tile URL for Leaflet |

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (server-only, never expose) |
| `SUPABASE_ANON_KEY` | Anon key (for auth token validation) |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |
| `OPENROUTER_MODEL` | e.g. `mistralai/mistral-7b-instruct` |
| `FRONTEND_URL` | Frontend origin for CORS |
| `ENVIRONMENT` | `development` or `production` |

---

## Deployment

### Frontend → Vercel

1. Push to GitHub
2. Import project in Vercel dashboard
3. Set **Root Directory** to `frontend`
4. Add all `NEXT_PUBLIC_*` environment variables
5. Deploy — auto-deploys on push to `main`

### Backend → Render

1. Create new **Web Service** in Render
2. Connect GitHub repo, set **Root Directory** to `backend`
3. Select **Docker** as runtime (uses `backend/Dockerfile`)
4. Add all backend environment variables
5. Set `FRONTEND_URL` to your Vercel production URL
6. Deploy

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Homepage — hero, live stats, services preview, map placeholder |
| `/monitoring` | Live monitoring dashboard with Realtime updates |
| `/services` | District services directory |
| `/map` | Interactive zone map (Leaflet integration pending) |
| `/complaints` | Submit and track citizen complaints |
| `/complaints/:id` | Complaint detail with AI summary |
| `/admin` | Admin dashboard for complaint management |
| `/auth/login` | Login with email/password (ASAN eID placeholder) |

---

## API Endpoints

Full Swagger docs: `http://localhost:8000/docs`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/monitoring/air-quality` | Air quality data |
| GET | `/monitoring/traffic` | Traffic data |
| GET | `/monitoring/utilities` | Utilities data |
| GET | `/monitoring/incidents` | Incident data |
| GET | `/complaints/` | List complaints |
| POST | `/complaints/` | Create + AI classify complaint |
| PATCH | `/complaints/{id}` | Update complaint status |
| GET | `/district-map/zones` | District zones |
| GET | `/auth/me` | Current user profile |
| GET | `/open-data/summary` | AI-generated district summary |
| GET | `/health` | Health check |

---

## Architecture

See [docs/architecture.md](docs/architecture.md) for system diagrams, auth flow, Realtime flow, and deployment architecture.

---

## Development Notes

- **UI**: All components use plain Tailwind CSS with `UI placeholder` comments. Design will be applied in a later phase.
- **Azerbaijani locale**: `<html lang="az">`, all labels and buttons in Azerbaijani.
- **ASAN eID**: Login button exists as a placeholder — integration requires official credentials from the district authority.
- **Map**: Leaflet placeholder in `/map` — install `react-leaflet leaflet @types/leaflet` and implement the map component.
- **AI degradation**: OpenRouter calls are wrapped in try/catch — complaint creation always succeeds even if AI classification fails.
