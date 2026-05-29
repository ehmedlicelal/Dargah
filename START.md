You are a senior full-stack architect specializing in government/smart-city platforms.
We are building “Nərimanov Digital” — the official Digital Monitoring & Smart Services Platform for Nərimanov District, Baku, Azerbaijan.
Important instructions from the client:

We will design and polish the UI ourselves later. For now, generate clean, functional, minimal UI using only Tailwind CSS + basic React components (no heavy design, no shadcn/ui, no fancy animations, no glassmorphism). Use simple cards, tables, and buttons with clear placeholders like <!-- UI to be styled later -->.
Focus on correct architecture, folder structure, integrations, and working code skeleton.

Exact Tech Stack (use only this)
Frontend: Next.js 15 (App Router) + TypeScript + Tailwind CSS
Backend: Python + FastAPI (Python 3.12)
Database: Supabase (PostgreSQL + Auth + Storage + Realtime)
AI Integration: OpenRouter (for smart features like complaint classification, report summarization, predictive insights)
Deployment: Frontend → Vercel | Backend → Render (with environment variables)
Project Structure
Generate a complete monorepo-style starter (or clear instructions for two repos). Include:
text/narimanov-digital/
├── frontend/          (Next.js)
├── backend/           (FastAPI)
├── supabase/          (migrations + seed.sql)
├── docs/
│   └── architecture.md
└── README.md
What to Generate First

Complete folder structure for both frontend and backend with all important files shown as code blocks.
Frontend (Next.js)
Full app/ directory structure with pages/routes:
/ (homepage with placeholders for Hero, Monitoring Dashboard, Services, Map)
/monitoring, /services, /map, /complaints, /admin

Supabase client setup (lib/supabase.ts)
API route examples calling FastAPI (app/api/)
Basic auth flow using Supabase Auth + ASAN-like login placeholder
Environment variables template
Simple React components for main sections (with comments where UI will go later)

Backend (FastAPI)
Main main.py with FastAPI app
Folder structure: routers/, schemas/, models/, services/, crud/, core/
Key endpoints skeletons (with Pydantic models):
/monitoring/air-quality, /traffic, /utilities, /incidents
/complaints/ (CRUD + OpenRouter AI classification)
/auth/, /district-map/, /open-data/

Supabase connection using supabase-py
OpenRouter integration example (async client for complaint analysis)
CORS, rate limiting, logging setup
requirements.txt and Dockerfile for Render

Supabase(i have added mcp server)
schema.sql with main tables (district_zones, monitoring_data, complaints, users, etc.)
Row Level Security (RLS) policies example
Realtime subscriptions example for live monitoring

Additional
architecture.md explaining folder structure and how frontend ↔ backend ↔ Supabase ↔ OpenRouter works
.env.example files for both frontend and backend
Clear comments everywhere: “UI placeholder — replace with your design” and “TODO: connect real API here”
Deployment instructions (Vercel + Render) + how to run locally


Start by outputting the full project structure + the most important files first (README, frontend layout, backend main.py, Supabase schema). Make the code immediately runnable with npm run dev and uvicorn main:app.
Use natural Azerbaijani text for all labels and buttons (I will adjust later).
Begin now.