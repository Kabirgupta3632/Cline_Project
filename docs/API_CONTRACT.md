# RakshaRakt – API Contract

> Every endpoint returns `{ ok: boolean, data?: T, error?: string }`.
> All timestamps are ISO 8601. All IDs are UUIDs.
> Auth is simulated via `x-role-id` header (seeded hospital/donor ID).

---

## AI Routes — Owner: Person 2

### `POST /api/ai/extract-slip`
Parse a blood requisition slip (image OCR or raw text) using Gemini.

**Request** `{ "text": "string?", "base64Image": "string?", "mimeType": "image/jpeg" }`
**Response** `{ "blood_group": "A+|null", "units": 2, "urgency": "normal|critical", "hospital_name": "str|null", "patient_note": "str|null", "confidence": 0.92 }`

### `POST /api/ai/rank-donors`
Rank candidate donors for an SOS. Gemini-assisted, deterministic fallback.

**Request** `{ "sos_id": "uuid", "donor_ids": ["uuid"] }`
**Response** `[{ "donor_id": "uuid", "score": 87, "reason": "string" }]`

---

## SOS Routes — Owner: Person 1

### `POST /api/sos`
Create SOS. Auto-triggers inventory mesh check. Status starts as `inventory_check`.

**Request** `{ "hospital_id": "uuid", "blood_group": "B+", "units_needed": 2, "urgency": "normal|critical", "patient_note?": "str", "raw_slip_text?": "str" }`
**Response** `{ "sos": { SosRequest }, "inventory_matches": [ InventoryMeshMatch ] }`

### `GET /api/sos/:id`
Full SOS detail: hospital name, notifications counts, dispatches with ETAs.

**Response** `{ SosDetail }` — see lib/types.ts `SosDetail`

### `POST /api/sos/:id/broadcast`
Start or continue broadcasting to eligible donors within current radius.

**Request** `{}`  **Response** `{ "donors_notified": 5, "total_notified": 12 }`

### `POST /api/sos/:id/escalate`
Widen radius +10 km (max 50 km). Notifies newly in-range donors.

**Request** `{}`  **Response** `{ "new_radius_km": 25, "donors_notified": 3 }`

---

## Inventory Routes — Owner: Person 1

### `GET /api/inventory/mesh?sos_id=<uuid>`
Nearby hospitals with surplus stock for the SOS blood group.

**Response** `[ InventoryMeshMatch ]`

### `POST /api/inventory/transfer`
Create inter-hospital transfer request.

**Request** `{ "sos_id": "uuid", "from_hospital_id": "uuid", "to_hospital_id": "uuid", "blood_group": "O-", "units": 2 }`
**Response** `{ "id": "uuid", "status": "pending", "created_at": "ISO" }`

### `PATCH /api/inventory/:hospital_id`
Update blood stock for a group.

**Request** `{ "blood_group": "O-", "units_available": 12, "units_reserved": 2, "surplus_threshold": 3 }`
**Response** `{ "hospital_id": "uuid", "blood_group": "O-", "units_available": 12, "updated_at": "ISO" }`

---

## Donor Routes — Owner: Person 3

### `GET /api/donor/:id/notifications`
All notifications for a donor (populates in-app notification panel).

**Response** `[{ "id": "uuid", "sos_id": "uuid", "blood_group": "A+", "urgency": "critical", "hospital_name": "str", "distance_km": 2.4, "status": "sent", "sent_at": "ISO", "patient_note": "str|null" }]`

### `POST /api/donor/respond`
Donor answers Yes or No to an SOS notification.

**Request** `{ "notification_id": "uuid", "answer": "yes|no", "snooze": "1h|4h|24h|today" }`
**Response** `{ "notification_id": "uuid", "status": "accepted|declined", "dispatch_id": "uuid|null", "snooze_until": "ISO|null" }`

### `POST /api/donor/location`
Location ping every 10-15 s while donor is en_route.

**Request** `{ "donor_id": "uuid", "lat": 26.1445, "lng": 91.7362 }`
**Response** `{ "dispatch_id": "uuid", "eta_minutes": 9 }`

### `GET /api/donor/:id/profile`
Full donor profile with rewards, badges, ledger, coupons.

**Response** `{ DonorProfile }` — see lib/types.ts `DonorProfile`

---

## Dispatch Routes — Owner: Person 4

### `POST /api/dispatch/en-route`
Mark donor en_route. Creates dispatch row.

**Request** `{ "donor_id": "uuid", "sos_id": "uuid" }`
**Response** `{ "dispatch_id": "uuid", "eta_minutes": 14, "status": "en_route" }`

### `POST /api/dispatch/cancel`
Cancel a dispatch.

**Request** `{ "dispatch_id": "uuid" }`  **Response** `{ "dispatch_id": "uuid", "status": "cancelled" }`

### `POST /api/dispatch/arrived`
Donor marks arrival at hospital.

**Request** `{ "dispatch_id": "uuid" }`  **Response** `{ "dispatch_id": "uuid", "status": "arrived" }`

### `POST /api/dispatch/donated`
Hospital confirms donation. Triggers reward points (+50, +25 if critical).

**Request** `{ "dispatch_id": "uuid" }`  **Response** `{ "dispatch_id": "uuid", "status": "donated", "points_awarded": 50 }`

### `GET /api/dispatch?sos_id=<uuid>`
Live list of dispatches for an SOS with ETAs.

**Response** `[ DispatchWithDonor ]`

### `POST /api/dispatch/ghost-sweep`
Detect ghosts (no movement within GHOST_WINDOW_MIN), replace with next best donor.

**Request** `{}`
**Response** `{ "ghosts_found": 1, "replacements_notified": 1, "details": [{ "dispatch_id": "uuid", "donor_id": "uuid", "sos_id": "uuid", "replacement_donor_id": "uuid|null" }] }`

---

## Rewards Routes — Owner: Person 4

### `GET /api/rewards/:donor_id`
Hero points, badges, ledger, available coupons.

**Response** `{ "donor_id": "uuid", "hero_points": 185, "badges": [...], "ledger": [...], "available_coupons": [...] }`

### `POST /api/rewards/redeem`
Redeem a coupon with hero points.

**Request** `{ "donor_id": "uuid", "coupon_id": "uuid" }`
**Response** `{ "coupon_code": "APOLLO15", "points_spent": 150, "remaining_points": 35 }`

---

## Demo Routes — Owner: Person 4

### `POST /api/demo/reset`
Reset DB to seed state.

**Request** `{}`  **Response** `{ "reset": true }`

### `POST /api/demo/time-warp`
Advance virtual time for demo.

**Request** `{ "advance_minutes": 60 }`  **Response** `{ "warped_minutes": 60 }`

---

## Points Reference

| Event | Δ Points |
|---|---|
| Responded Yes | +10 |
| Donation confirmed | +50 |
| Critical bonus | +25 |
| Ghosted | -10 |

## Badge Reference

| Code | Trigger |
|---|---|
| `first_responder` | First Yes response |
| `life_saver` | 1 confirmed donation |
| `hero` | 5 confirmed donations |
| `night_owl` | Responded 22:00–05:00 |
| `reliable` | 3 arrivals, 0 ghosts |
