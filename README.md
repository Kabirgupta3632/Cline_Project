# 🩸 RakshaRakt — Emergency Blood Donation Platform

Built in 8 hours for the Cline AI Builders hackathon. A hospital broadcasts an
urgent blood need; nearby compatible donors get an in-app alert with
[Yes]/[No]; critical cases escalate radius automatically; donors who accept
become "En Route" with a live ETA; ghosting donors are auto-replaced; before
bothering civilians the system checks neighbouring hospitals for surplus
stock via the **Inventory Mesh**. Donors earn Hero Points, badges, and coupons.

## Tech stack

- **Next.js 14 (App Router) + TypeScript (strict) + Tailwind CSS** — all API
  routes live in `app/api/**` route handlers, no separate backend server.
- **Supabase (Postgres + PostGIS + Realtime)** — geo queries via SQL RPC
  functions (`ST_DWithin` / `ST_Distance`), see `db/`.
- **Google Gemini** (`gemini-1.5-flash`) via `@google/generative-ai` — slip
  OCR + donor ranking, both with a deterministic mock fallback so the demo
  never breaks without an API key.
- **Zod** for input validation on every API route. Every response is
  `{ ok: true, data } | { ok: false, error }` (see `lib/types.ts`).

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase + Gemini credentials
```

Then, against your Supabase project's SQL editor, run in order:

```sql
-- 1. db/schema.sql           (tables, enums, PostGIS, Realtime publication)
-- 2. db/functions.sql        (match_eligible_donors, find_surplus_hospitals, ...)
-- 3. db/dispatch_functions.sql
-- 4. db/seed.sql             (3 hospitals + 25 donors around Guwahati/Goalpara)
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and choose a role:
**Hospital**, **Donor**, or **Demo Panel** (no real auth — "Login as" picks a
seeded row).

## Repo layout

```
/db                 schema.sql, functions.sql, seed.sql           (Person 1)
/lib                supabase.ts, geo.ts, compat.ts, types.ts, gemini.ts, api-client.ts
/app/api/sos         create SOS, list, escalate, broadcast        (Person 1)
/app/api/ai          extract-slip, rank-donors                    (Person 2)
/app/api/inventory   mesh check, transfer request, update stock   (Person 1)
/app/api/donor       respond, snooze, location, profile           (Person 3)
/app/api/dispatch    en-route, eta, cancel, ghost-sweep           (Person 4)
/app/api/rewards     points, badges, coupons, redeem              (Person 4)
/app/hospital/*      hospital dashboard UI                        (Person 2)
/app/donor/*         mobile-first donor UI                        (Person 3)
/app/demo            demo control panel + simulator               (Person 4)
/docs/API_CONTRACT.md  full request/response shapes
/components/ui       shared Button/Card/Badge/Modal/BloodGroupTag (Person 3)
```

## Business rules implemented

1. Blood compatibility matching (exact-first, critical widens to compatible
   groups, O- universal donor) — `lib/compat.ts`.
2. Eligibility filtering (90-day cooldown, availability, snooze) — enforced in
   the `match_eligible_donors` SQL RPC.
3. Radius escalation: normal 5km fixed; critical starts at 15km, +10km every
   `DEMO_ESCALATION_SECONDS`, capped at 50km.
4. Inventory Mesh: surplus hospitals within 15km surfaced before broadcast;
   critical SOS fires a transfer request + donor broadcast in parallel.
5. Snooze modal (1h / 4h / 24h / today 23:59) stores `donors.snooze_until`.
6. Anti-ghosting: `/api/dispatch/ghost-sweep` marks stalled donors ghosted,
   penalizes, and re-matches the next best donor — callable from the demo
   panel button or a dashboard poll.
7. ETA = haversine distance / 25km/h + 2min buffer, recomputed on each ping.
8. Rewards ledger, badges (First Responder, Life Saver, Hero, Night Owl,
   Reliable), and fake-partner coupon redemption.
9. Privacy: hospitals only ever see donor name/group/ETA/status, never exact
   location — enforced via the `DonorPublic` type and `GET /api/sos/[id]`.

See `docs/API_CONTRACT.md` for exact request/response JSON shapes of every
endpoint.
