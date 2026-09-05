# 🌉 Setu - Smart Logistics & Accessibility Intelligence Platform

> AI-Based Smart Logistics and Accessibility Intelligence Platform for India's North Eastern Region (SIH26002)

**Ministry**: Development of North Eastern Region (MDoNER)

---

## What is Setu?

Setu monitors real-time road and transport accessibility across NER districts, predicts route disruptions from landslides, floods, and road damage, and provides AI-based alternate safe routing. It includes a GIS accessibility dashboard, GPS-relevant vehicle awareness, real-time alerts, and field-level mobile/web reporting.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                         │
│           Next.js 15 (App Router) + PWA             │
│         Leaflet Map + Supabase Realtime             │
├─────────────────────────────────────────────────────┤
│                  Supabase                           │
│    Auth │ Postgres+PostGIS │ Realtime │ RLS         │
├─────────────────────────────────────────────────────┤
│              Risk Engine (FastAPI)                  │
│   NetworkX Graph │ Risk Scoring │ Safe Routing      │
├─────────────────────────────────────────────────────┤
│              External Services                      │
│     OpenWeatherMap │ Twilio (SMS/WhatsApp)           │
└─────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.12+
- Supabase account ([supabase.com](https://supabase.com))

### 1. Clone & install
```bash
git clone <repo-url>
cd setu

# Frontend
cd frontend && npm install

# Risk Engine
cd ../services/risk-engine
python -m venv .venv
.venv/Scripts/activate     # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

### 2. Configure environment
```bash
# Copy the env template
cp .env.example .env

# Fill in your Supabase credentials:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - SUPABASE_JWT_SECRET

# Also copy for the risk engine:
cp services/risk-engine/.env.example services/risk-engine/.env
```

### 3. Set up the database
Run the SQL migrations in order against your Supabase project:
1. `infra/supabase/migrations/001_enable_extensions.sql`
2. `infra/supabase/migrations/002_create_tables.sql`
3. `infra/supabase/migrations/003_enable_rls.sql`
4. `infra/supabase/migrations/004_audit_triggers.sql`
5. `infra/supabase/migrations/005_seed_east_khasi_hills.sql`

### 4. Run locally
```bash
# Terminal 1: Frontend
cd frontend && npm run dev

# Terminal 2: Risk Engine
cd services/risk-engine
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Frontend: http://localhost:3000
Risk Engine: http://localhost:8000
Health Check: http://localhost:8000/health

## Project Structure

```
setu/
├── frontend/             # Next.js 15 App Router + PWA
│   ├── src/
│   │   ├── app/          # Pages and layouts
│   │   ├── components/   # Reusable UI components
│   │   └── lib/          # Supabase clients, types, utilities
│   └── public/           # Static assets, service worker
│
├── services/
│   └── risk-engine/      # FastAPI — risk scoring + safe routing
│       ├── core/         # Config, security (JWT)
│       ├── routers/      # API endpoints
│       └── schemas/      # Pydantic models
│
└── infra/
    ├── docker-compose.yml
    └── supabase/
        ├── migrations/   # SQL schema + RLS + triggers
        └── seed/         # OSM data fetcher
```

## Security Model

| Layer | Implementation |
|---|---|
| **In transit** | TLS everywhere (HTTPS, HSTS) |
| **At rest** | Supabase native encryption |
| **Field reports** | AES-GCM client-side encryption (Web Crypto API) |
| **Access control** | Row-Level Security on every table |
| **Auth** | Supabase OTP + short-lived JWTs + refresh rotation |
| **Audit** | Trigger-based audit log on all sensitive tables |
| **API security** | Rate limiting, input validation (zod/pydantic), CORS lock |

## Seed Data

The platform is pre-seeded with **15 road segments** across East Khasi Hills (Meghalaya):
- NH6 (Guwahati → Shillong corridor)
- NH40 (Shillong → Dawki corridor)
- Local roads (Mawlai, Laban, Smit, Cherrapunji)

Each segment has realistic base risk scores based on terrain, rainfall, and historical incident data.

## Roles

| Role | Permissions |
|---|---|
| **Reporter** | Submit reports, view own reports, see map/alerts |
| **Driver** | Same as reporter + safe routing |
| **Official** | Verify/reject reports in their district, see all district data |
| **Admin** | Full access + user management + audit log |

## License

MIT
