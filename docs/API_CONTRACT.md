# RakshaRakt API Contract

Every route handler lives under `app/api/**` and returns the shared envelope from
`lib/types.ts`:

```ts
type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };
```

All request bodies are validated with `zod`. Dates are ISO 8601 strings. Blood
groups are one of `A+ A- B+ B- AB+ AB- O+ O-`. IDs are UUID strings.

> Each team member owns a section below. If you need an endpoint that isn't
> documented yet, add your proposed shape here and implement it - don't block
> on someone else's section being "finished".

---

## Matching engine additions (Person 1, Tier 2) - `lib/matching.ts`

`lib/matching.ts` is now the single source of truth for donor matching +
notification, extracted out of `app/api/sos/_lib/broadcast.ts` (which is kept
as a thin re-export wrapper for backward compatibility - existing imports of
`@/app/api/sos/_lib/broadcast` keep working unchanged). It exports:

- `findEligibleDonors(supabase, params)` - wraps the `match_eligible_donors`
  RPC and applies the two TS-layer rules below.
- `insertNotifications(supabase, sosId, donors)`
- `getSosOrThrow(supabase, sosId)` / `updateSosStatus(supabase, sosId, patch)`
- `notifyNextDonors(supabase, sosId, count?)` - high-level "match + notify up
  to `count` donors" entry point. **Person 4's `/api/dispatch/cancel` and
  `/api/dispatch/ghost-sweep` should import this directly (with `count: 1`)
  instead of re-implementing matching.**
- `escalateIfNeeded(supabase, sosId)` - high-level "widen radius if critical,
  re-match, persist" entry point used by `/api/sos/escalate`.
- `assertHospitalVerified(supabase, hospitalId)` - throws `Error("hospital_not_verified")`
  if the hospital isn't verified (rule 7, see below).

### Rule 5: Dispatch fatigue guard (anti-spam)

A donor who has already received **>= 3 notifications (for any SOS) in the
last 24 hours** is excluded from further matching, **unless** the current SOS
has `urgency: "critical"` (critical always bypasses the fatigue guard - life
over donor comfort). Implemented in TS (`lib/matching.ts#filterOutFatiguedDonors`)
on top of the `match_eligible_donors` RPC results, since it depends on
cross-SOS notification history that's simplest to query directly rather than
threading through the RPC signature. Fails open (never blocks a broadcast) if
the fatigue-check query itself errors.

### Rule 6: Smart quiet hours (normal SOS only)

For `urgency: "normal"` SOS, donors are **not notified between 23:00-06:00
local server time** - the broadcast silently returns zero matches during that
window (no `notifications` rows are created, nothing to clean up later).
`urgency: "critical"` SOS **always** broadcasts regardless of the hour.
Implemented in `lib/matching.ts#isWithinQuietHours` /
`QUIET_HOURS_START`/`QUIET_HOURS_END` constants (23 / 6). This applies inside
`findEligibleDonors`, so it's enforced identically for `/api/sos/broadcast`,
`/api/sos/escalate`, `/api/sos/create`'s critical auto-broadcast path, and
Person 4's re-match calls via `notifyNextDonors`.

### Rule 7: Hospital verification gate (anti-misuse)

Only hospitals with `hospitals.verified = true` may trigger a civilian donor
broadcast. This protects against a compromised/fake hospital account spamming
real donors. Enforcement points:

- `POST /api/sos/broadcast` - returns `apiError("hospital_not_verified")`
  with HTTP 403 if the owning hospital isn't verified; no donors are notified
  and the SOS status is left unchanged.
- `POST /api/sos/create` (critical auto-broadcast path only) - if the
  hospital isn't verified, the auto-broadcast is skipped (SOS stays in
  `inventory_check` instead of flipping to `broadcasting`) and the response
  includes `broadcast_blocked_unverified: true`. The parallel inter-hospital
  **transfer request is NOT gated** by this check - unverified hospitals can
  still ask neighbouring hospitals for surplus stock, since that's a
  hospital-to-hospital transaction, not civilian-facing.
- `POST /api/sos/escalate` - returns `apiError("hospital_not_verified")` /
  403 the same way as `/api/sos/broadcast` (escalation is just a re-broadcast
  at a wider radius).

`hospitals.verified` defaults to `true` in `db/schema.sql` / `db/seed.sql` (no
real verification workflow exists for the hackathon) - set a hospital row's
`verified` column to `false` manually to demo this gate.

---

## /app/api/sos (Person 1)

### POST /api/sos/create
Request:
```json
{ "hospital_id": "uuid", "blood_group": "O+", "units_needed": 2, "urgency": "critical", "patient_note": "string?", "raw_slip_text": "string?" }
```
Response `data` (richer than the original skeleton - see implementation notes below):
```ts
{
  sos: SosRequest;                      // status starts 'inventory_check'
  mesh_recommendation: Array<{          // find_surplus_hospitals RPC result, always run BEFORE broadcast
    hospital_id: string; name: string; distance_km: number;
    units_available: number; units_reserved: number; surplus_threshold: number;
  }>;
  auto_transfer_request: TransferRequest | null; // only set for urgency='critical' + a surplus hospital exists
  broadcast: { notified_donor_ids: string[] } | null; // only set for urgency='critical' (auto-broadcasts in parallel with the transfer request); null for 'normal' (hospital calls /api/sos/broadcast explicitly after reviewing mesh_recommendation)
  broadcast_blocked_unverified?: boolean; // true if urgency='critical' but the hospital isn't verified (rule 7) - auto-broadcast was skipped, transfer request still proceeded
}
```
Implementation notes (business rules):
- `radius_km` is set to `NORMAL_RADIUS_KM` (5km) for normal urgency or
  `CRITICAL_START_RADIUS_KM` (15km) for critical, per `lib/geo.ts`.
- Mesh check (rule 4) always runs on create, before any broadcast, regardless
  of urgency - the hospital/UI can surface `mesh_recommendation` as a banner.
- For `urgency: "critical"`, create ALSO immediately fires a transfer request
  (to the closest surplus hospital, if any) AND broadcasts to eligible donors
  in parallel (`Promise.all`), then flips status to `broadcasting` - UNLESS
  the hospital fails the rule 7 verification gate, in which case the
  broadcast half is skipped (`broadcast_blocked_unverified: true`, status
  stays `inventory_check`) while the transfer request still proceeds.
- For `urgency: "normal"`, status stays `inventory_check` after create; the
  hospital decides whether to call `/api/inventory/transfer-request` or
  `/api/sos/broadcast` next.

### GET /api/sos/list?hospital_id=uuid&status=broadcasting&limit=50
Response `data`: `SosRequest[]` (newest first; `limit` optional, default 50, max 200).

### POST /api/sos/escalate
Request: `{ "sos_id": "uuid" }` (also auto-triggered by a client timer every
`DEMO_ESCALATION_SECONDS`).
Response `data`: `{ sos: SosRequest, newly_notified: number, newly_notified_donor_ids: string[] }`.
Returns `apiError("hospital_not_verified")` / HTTP 403 if the hospital fails
rule 7. Delegates to `lib/matching.ts#escalateIfNeeded`: radius is recomputed
via `currentEscalatedRadius(sos.created_at)` from `lib/geo.ts` for critical
requests (fixed at `NORMAL_RADIUS_KM` for normal requests); only donors
without an existing `notifications` row for this `sos_id` are notified
(enforced in the `match_eligible_donors` RPC), minus any donors excluded by
the rule 5 fatigue guard or rule 6 quiet hours.

### POST /api/sos/broadcast
Request: `{ "sos_id": "uuid" }` â€” moves status to `broadcasting` and notifies
eligible donors via `match_eligible_donors` RPC (see db/functions.sql), using
`getEligibleDonorGroups(blood_group, urgency)` from `lib/compat.ts` to decide
which blood groups qualify (exact-only for normal, exact + compatible for
critical). Also applies rule 5 (dispatch fatigue) and rule 6 (quiet hours)
via `lib/matching.ts#findEligibleDonors`.
Returns `apiError("hospital_not_verified")` / HTTP 403 if the hospital fails
rule 7 (no donors notified, SOS status unchanged in that case).
Response `data`: `{ sos: SosRequest, notified_donor_ids: string[] }`.

### GET /api/sos/[id] (Person 2 - cross-feature read aggregation for Hospital UI)
Read-only endpoint combining an SOS with its notifications + dispatches, with
donor fields reduced to the privacy-safe `DonorPublic` shape (name, blood_group,
hero_points, total_donations, ghost_count, is_available - NEVER location/phone/
snooze_until). Dispatch rows also omit `last_lat`/`last_lng` in this response -
only `eta_minutes` and `status` are shown, per privacy rule 9.
Response `data`:
```ts
{
  sos: SosRequest,
  notifications: Array<{ id, donor_id, distance_km, status, sent_at, donor: DonorPublic | null }>,
  dispatches: Array<{ id, donor_id, status, eta_minutes, accepted_at, donor: DonorPublic | null }>
}
```

---

## /app/api/inventory (Person 1)

### POST /api/inventory/mesh-check
Request: `{ "hospital_id": "uuid", "blood_group": "O+", "sos_id": "uuid?", "radius_km": 15 }`
(`sos_id` accepted for future audit logging but not persisted yet; `radius_km` optional, default 15km per rule 4.)
Response `data`: `{ surplus_hospitals: Array<{ hospital_id, name, distance_km, units_available, units_reserved, surplus_threshold }> }`
(uses `find_surplus_hospitals` RPC - hospitals within radius, excluding the
requesting hospital, where `units_available - units_reserved > surplus_threshold`.)

### POST /api/inventory/transfer-request
Request: `{ "sos_id": "uuid?", "from_hospital_id": "uuid", "to_hospital_id": "uuid", "blood_group": "O+", "units": 2 }`
(`from_hospital_id` must differ from `to_hospital_id`.)
Response `data`: `TransferRequest` (status starts `requested`).

### POST /api/inventory/update-stock
Request: `{ "hospital_id": "uuid", "blood_group": "O+", "units_available": 10, "units_reserved": 2, "surplus_threshold": 5 }`
(upserts on `(hospital_id, blood_group)`; rejects if `units_reserved > units_available`.)
Response `data`: `HospitalInventory`.

---

## /app/api/ai (Person 2)

### POST /api/ai/extract-slip
Request: `{ "image_base64": "string", "mime_type": "image/jpeg" }`
Response `data`: `SlipExtraction` from `lib/gemini.ts`
(`{ blood_group, units_needed, patient_note, urgency_hint, raw_text, source }`).
Always succeeds - falls back to a deterministic mock if `GEMINI_API_KEY` is
unset or the Gemini call fails.

### POST /api/ai/rank-donors
Request: `{ "sos_id": "uuid", "donors": DonorRankInput[] }`
Response `data`: `DonorRankResult[]` (`{ donor_id, score, reason }[]`, best first).

---

## /app/api/donor (Person 3)

### POST /api/donor/respond
Request: `{ "notification_id": "uuid", "donor_id": "uuid", "response": "yes" | "no" }`
Response `data`: `{ notification: SosNotification, dispatch: Dispatch | null }`
(`dispatch` is populated when `response = "yes"`).

### POST /api/donor/snooze
Request: `{ "donor_id": "uuid", "option": "1h" | "4h" | "24h" | "today" }`
Response `data`: `{ donor_id: string, snooze_until: string }`.

### POST /api/donor/location
Request: `{ "donor_id": "uuid", "dispatch_id": "uuid", "lat": number, "lng": number }`
Response `data`: `Dispatch` (with recomputed `eta_minutes`, sets `started_moving_at`
the first time coordinates differ from the accepted location).

### GET /api/donor/profile?donor_id=uuid
Response `data`: `{ donor: Donor, badges: Badge[], coupons_available: Coupon[], ledger: RewardsLedgerEntry[] }`.

### GET /api/donor/notifications?donor_id=uuid&status=sent
(Proposed addition - implemented.) Lists this donor's notifications joined
with the parent SOS + hospital for display in the notification feed.
Response `data`: array of
`{ id, sos_id, donor_id, distance_km, status, sent_at, responded_at, sos: { id, blood_group, units_needed, urgency, status, patient_note, created_at, hospital_name, hospital_address } | null }`.

### GET /api/donor/dispatch?dispatch_id=uuid
(Proposed addition - implemented.) Fetches one raw `Dispatch` row, used by the
en-route screen on initial load before the first location ping arrives.
Response `data`: `Dispatch`.

### Frontend notes (Tier 2-3 enhancements, no new API surface)
- **Realtime notifications** (`app/donor/notifications/page.tsx`): subscribes
  via `getSupabaseBrowserClient()` to `postgres_changes` on the `notifications`
  table filtered to `donor_id=eq.<id>`, re-running the existing
  `GET /api/donor/notifications` fetch on any insert/update. Requires the
  `notifications` table to be added to the project's Realtime publication in
  Supabase (Person 1 - `db/schema.sql` / dashboard toggle). A 60s poll remains
  as a fallback in case the Realtime channel never connects.
- **Simulate movement toggle** (`app/donor/en-route/[dispatchId]/page.tsx`):
  explicit checkbox that forces simulated GPS movement even when real
  geolocation permission is granted, so judges can demo the anti-ghost
  "started moving" check deterministically. Still pings `/api/donor/location`
  every 12s either way - no API change.
- **PWA layer**: `public/manifest.json` + `public/sw.js`, registered from
  `app/donor/layout.tsx`. The notifications page has an "Enable Alerts" button
  that requests `Notification` permission and fires a local `Notification()`
  (not server Web Push) for any notification row not seen before, plus a
  Web Audio siren beep + `animate-pulse` red card border when
  `urgency === 'critical'`.
- **Reward popup**: `components/ui/RewardPopup.tsx` fires on
  `app/donor/profile/page.tsx` when `GET /api/donor/profile` returns a badge
  id not previously seen (tracked in `localStorage`, key
  `raksharakt_seen_badge_ids`) - no API change, purely a client-side diff.
- **i18n**: `app/donor/i18n.ts` is a plain English/Hindi/Assamese dictionary
  (no library) used only by the notifications page copy; language choice
  persisted in `localStorage` (`raksharakt_donor_lang`).

### Tier 4 - QR confirmation code (blocked on Person 4)
Plan: once Person 4's `dispatches.confirmation_code` column /
`/api/dispatch/confirm-donated` support merges into `main`, the en-route page
will render a QR code (client-side only, e.g. a small canvas-based QR
generator - no new dependency added yet) of that code so the hospital can
scan/enter it to confirm the donation. **As of this PR, no
`confirmation_code` field exists anywhere in `main`** (confirmed via
codebase search) - this is intentionally deferred until that schema change
lands, per the coordination note in the original task breakdown. Will
`git pull --rebase origin main` and add this once available.

---

## /app/api/dispatch (Person 4)

> **Re-matching note (Tier 2, Person 1 -> Person 4 handoff):** `/api/dispatch/cancel`
> and `/api/dispatch/ghost-sweep` currently use their own
> `app/api/dispatch/_lib/rematch.ts#rematchAndNotifyNext` helper. Please switch
> both call sites to `notifyNextDonors(supabase, sosId, 1)` from
> `lib/matching.ts` instead - it's the same "find next best eligible donor,
> notify them" behavior but also picks up the rule 5 (fatigue) and rule 6
> (quiet hours) guards for free, and will stay in sync with any future
> matching-logic changes automatically. `rematchAndNotifyNext` can then be
> deleted. Not done in this PR to avoid touching files outside `/app/api/sos`
> and `/app/api/inventory` - flagging here per the "mock/coordinate via the
> contract" rule instead.

### POST /api/dispatch/en-route
Request: `{ "sos_id": "uuid", "donor_id": "uuid" }` (usually called internally by
`/api/donor/respond` on "yes", exposed too for the demo panel).
Response `data`: `Dispatch`.

### POST /api/dispatch/eta
Request: `{ "dispatch_id": "uuid" }`
Response `data`: `{ dispatch_id: string, eta_minutes: number }`.

### POST /api/dispatch/cancel
Request: `{ "dispatch_id": "uuid", "reason": "string?" }`
Response `data`: `Dispatch` (status -> `cancelled`).

### POST /api/dispatch/confirm-donated
Request: `{ "dispatch_id": "uuid" }` (hospital taps "Confirm donated").
Response `data`: `Dispatch` (status -> `donated`) + triggers `/api/rewards/points`.

### POST /api/dispatch/ghost-sweep
Request: `{ "sos_id": "uuid?" }` (omit to sweep all active dispatches).
Response `data`: `{ ghosted: string[], replacement_notified: string[] }`.

---

## /app/api/rewards (Person 4)

### POST /api/rewards/points
Request: `{ "donor_id": "uuid", "reason": "yes_response"|"donation_confirmed"|"critical_bonus"|"ghosted", "sos_id": "uuid?" }`
Response `data`: `{ ledger_entry: RewardsLedgerEntry, new_total: number, new_badges: Badge[] }`.

### GET /api/rewards/badges?donor_id=uuid
Response `data`: `Badge[]`.

### GET /api/rewards/coupons
Response `data`: `Coupon[]`.

### POST /api/rewards/redeem
Request: `{ "donor_id": "uuid", "coupon_id": "uuid" }`
Response `data`: `{ redeemed: true, remaining_points: number }` or `apiError("insufficient_points")`.

---

## Role switcher (no auth)

### GET /api/roles/seed-options
Response `data`: `{ hospitals: {id,name}[], donors: {id,name,blood_group}[] }`
used to populate the "Login as" dropdown.
