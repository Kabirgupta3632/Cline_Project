# RakshaRakt - Emergency Blood Donation Platform

Cline AI Builders Hackathon

## Setup

### 1. Install
```bash
npm install
```

### 2. Environment
```bash
cp .env.example .env.local
# Fill in Supabase + Gemini keys
```

### 3. Database (Supabase SQL Editor - run in order)
1. `db/schema.sql` - tables, enums, indexes
2. `db/functions.sql` - PostGIS RPC functions
3. `db/seed.sql` - 3 hospitals + 25 donors in Guwahati

### 4. Run
```bash
npm run dev
# http://localhost:3000
```

## Tech Stack
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres + PostGIS + Realtime)
- Google Gemini API (gemini-1.5-flash) with deterministic fallback

## Demo Flow
1. Login as Hospital -> create SOS -> Inventory Mesh check
2. Broadcast to donors -> nearby compatible donors notified
3. Donor taps Yes -> En Route with live ETA
4. Hospital confirms donation -> Donor earns Hero Points + badges
5. Demo panel: Ghost Sweep, Time Warp, Reset

## Key Env Vars for Demo
- DEMO_ESCALATION_SECONDS=30 (fast radius escalation)
- GHOST_WINDOW_MIN=2 (fast ghost detection)

## API Reference
See /docs/API_CONTRACT.md
