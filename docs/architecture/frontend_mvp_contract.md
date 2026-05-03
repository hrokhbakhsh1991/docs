# Frontend MVP Contract — Single Source of Truth

Document-ID: ARCH-FE-MVP-CONTRACT-001  
Version: 1.0  
Status: **Active (engineering)**  
Owner: Architecture / Platform  
Last-Updated: 2026-05-03  
Audience: Frontend (`apps/web`), Backend, Product

## Purpose

Reconcile inconsistencies between:

- `docs/10-product/wireflows_must_have_journeys_v2.md` (**wireflows**)
- `docs/10-product/frontend_readiness_tasks.md` (**readiness**, esp. §A2)
- `apps/api/openapi.json` (**OpenAPI**)
- **`docs/runtime-lifecycle.md`** (**runtime semantics** aligned with shipped backend behavior)
- Current implementation under `apps/web`

This document is the **single source of truth for what the web client must implement** for MVP-aligned delivery. Where older product prose disagrees, this file overrides **until** upstream wireflows are rewritten to match it.

---

## Precedence Rules (binding order)

1. **OpenAPI** — what exists and which operations are authenticated vs not (per operation `security`).
2. **`docs/runtime-lifecycle.md`** — **actual transitions** after a successful mutation (registration status vs payment status).
3. **Readiness §A2** — correct **intent** for the **canonical public-placement** path naming (`POST /tours/{tourId}/register`) and lifecycle split (placement vs payment vs waitlist).
4. **Wireflows J-P-01 narrative** — **must be revised** downstream: today it asserts `POST /registrations` and **initial `Pending`**, which **conflicts** with readiness + runtime for the **canonical public/register path**.

---

## PHASE 1 — Registration flow (resolved)

### A) Wireflows J-P-01 (current text)

States:

- Participant registers via **`POST /api/v2/registrations`**
- Initial UI expectation: **`Pending`**
- Waitlist alternate: **`POST /api/v2/waitlist-items`**

### B) Readiness §A2 (canonical public funnel)

States:

- **Canonical public registration:** **`POST /api/v2/tours/{tourId}/register`**
- When capacity allows: **`Registration.status` begins at `Accepted`** (not `Pending` for this path).
- Capacity full → **explicit waitlist** path **`POST /api/v2/tours/{tourId}/waitlist`**
- Payment occurs **after** placement when required (see Phase 2).

### C) Current `apps/web` implementation

- Authenticated-flow intake on **`POST /api/v2/registrations`** (+ authenticated **`POST /api/v2/waitlist-items`** on capacity-full branch).
- **Does not call** **`POST …/register`** nor **`POST …/waitlist`** today.

### D) OpenAPI (facts)

Operations exist concurrently:

| Operation | Typical role (per summary + responses) |
|-----------|----------------------------------------|
| `POST /api/v2/tours/{tourId}/register` | **Public-style placement**, capacity-aware (`publicRegister`). **No `security: bearer` stanza on the operation.** Response schema is loosely typed (`additionalProperties: true`). |
| `POST /api/v2/tours/{tourId}/waitlist` | Explicit public waitlist; **typed response** (`waitlistItemId`, `queuePosition`). |
| `POST /api/v2/registrations` | **`security: bearer`**, **required Idempotency-Key**. Returns **`RegistrationResponseDto`**. Intended for authenticated **participant/leader-created** registrations. |
| `POST /api/v2/bookings` | **`security: bearer`**, authenticated shortcut (**`CreateBookingDto`** = `{ tourId }`). |
| `POST /api/v2/waitlist-items` | Authenticated workspace waitlist enrollment (distinct from `/tours/.../waitlist`). |

**Conclusion:** None of `{register, registrations, bookings}` should be casually labeled **“legacy-only”**:

- **`POST …/register` + `POST …/waitlist`** — **canonical public/on-ramp** paths in readiness + reflected in backend runtime doc.
- **`POST /registrations` + `/bookings` + `/waitlist-items`** — **valid authenticated adjuncts** used by workspace-style clients and leaders; they are **not deprecated** merely because public paths exist.

### Intended MVP product behavior (engineering decision)

**Binding MVP behavior:** align web participant placement with **`docs/runtime-lifecycle.md`**:

- Placement when capacity OK → **`Accepted`** via **preferred** **`POST /api/v2/tours/{tourId}/register`**.
- Placement when capacity full → **waitlisted** outcome via **`POST /api/v2/tours/{tourId}/waitlist`** (participant UX should show waitlist acknowledgement, **not** a fake `Pending registration` pretending to be a seat).

Authenticated workspace may still optionally use **`POST /registrations`** or **`POST /bookings`** if product explicitly wants **“session-bound intake”**, but **default web funnel** SHOULD converge on tour-scoped operations to satisfy readiness + runtime + OpenAPI layering.

---

### Final recommended flow — User → Tour → Registration → Waitlist → Payment

```text
1) Participant browses catalogue
     GET /api/v2/tours?search (optional)

2) Participant opens tour
     GET /api/v2/tours/{tourId}

3) Participant submits intake (placement)
     PRIMARY: POST /api/v2/tours/{tourId}/register
       · Body: CreateRegistrationDto (tenantId, tourId, participant fields…)
       · Header: Optional idempotency-key (recommended for FE reliability)

   CAPACITY AVAILABLE (happy path placement):
       · Backend: Registration.status transitions per runtime doc (typically Accepted on public path)
       · Next: Payment phase if applicable (Phase 2)

   CAPACITY FULL:
     OPTION A (canonical readiness): POST /api/v2/tours/{tourId}/waitlist
       · Body per CreateWaitlistItemDto contract
       · Response includes waitlistItemId + queuePosition (typed in OpenAPI)
     OPTION B (workspace-authenticated adjunct): POST /api/v2/waitlist-items
       · Requires bearer (current FE pattern)
       · Use only when product explicitly requires authenticated waitlist parity

   TRANSITIONAL (until FE migrates off): POST /api/v2/registrations (bearer + Idempotency-Key)
       · Allowed for authenticated MVP only with explicit acknowledgement that semantics may differ vs public path until backend guarantees parity

   OPTIONAL SHORTCUT: POST /api/v2/bookings (bearer) when server-derived participant projection is acceptable

4) Track status / payment aggregates
     GET /api/v2/registrations/{registrationId}
       · Poll/refetch authoritative registration + embedded payment projection

5) Payment (see Phase 2)
```

---

## PHASE 2 — Payment architecture clarification

### OpenAPI endpoints (participant vs admin/tooling)

- **`POST /api/v2/payments/intent`** (`CreatePaymentIntentDto` → **`PaymentResponseDto`**) — **participant/authenticated mutation** scoped by **`security: bearer`** in OpenAPI. **Requires `Idempotency-Key` header.**
  - Inputs include **`registrationId`**, **`amount`**, **`currency`**, **`paymentProvider`** (+ optional identifiers).
  - Returned **`PaymentResponseDto.status`** is an **enum lifecycle**: Pending | Paid | Failed | Refunded | Cancelled.

- **`GET /api/v2/admin/payments`** / **`GET /api/v2/admin/payments/{id}`** / **`POST …/refund`** — **admin/operator tooling** (same bearer assumption in contract; RBAC enforced server-side).

### Synchronous vs asynchronous

**Asynchronous confirmation model** consistent with **`docs/runtime-lifecycle.md` + readiness §B**:

- Creating an intent establishes a **Payment entity** commonly in **`Pending`**.
- PSP / webhook completes settlement; **registration aggregate** progresses (e.g. **`Accepted → AcceptedPaid`** on Paid; failure paths per runtime doc).
- Frontend **must not** treat mutation success alone as “money captured” unless `Payment.status` (or registration-derived outcome) confirms it.

### Which endpoint FE must call

**Participant-facing payment creation:** **`POST /api/v2/payments/intent`** (when product requires gated payment).

**Participant-facing truth / polling:** **`GET /api/v2/registrations/{registrationId}`**:

- Displays **`registration.status`**, **`paymentStatus`** summary fields, **`payment`** snapshot when present — per OpenAPI `RegistrationResponseDto`.
- Optionally poll cadence keyed off **combined** Pending payment + Accepted registration semantics (until terminal states).

**Admin dashboards / investigations:** **`/api/v2/admin/payments*`** — **not required** for baseline participant MVP unless product demands operator payment console inside web MVP.

---

## PHASE 3 — Telegram scope clarification

OpenAPI exposes:

- `POST /api/v2/auth/telegram/session`
- `POST /api/v2/auth/link-telegram` (**requires Idempotency-Key** per OpenAPI)

**Product scope** (`docs/10-product/mvp_scope.md`) mentions dual-mode Telegram + web historically.

### Engineering MVP decision (delivery contract)

Given **`apps/telegram` is presently a scaffold** (“integration not implemented”) and **`apps/web` does not integrate link-telegram nor telegram session**:

- **Telegram is NOT required to ship MVP web-engineering cutoff** labeled “Web Participant + Leader MVP” — **provided product formally accepts dual-mode slips to Phase 2** OR accepts **web-first release**.

- **If product insists Telegram is mandatory for MVP label**, Telegram becomes **blocking** delivery; minimal integration MUST include:
  1. `POST …/telegram/session` from mini-app bootstrap payload.
  2. Subsequent tour browse + **`POST …/register` or bearer parity path** aligned with Phase 1.
  3. Optional `POST …/link-telegram` surfaced in web Settings when web session exists.

**Default stance in THIS contract:** **Telegram = Phase 2** for engineering unless product explicitly promotes it to blocker.

---

## SECTION 4 — Web client REQUIRED OpenAPI endpoints (MVP cohort)

Minimal set the **`apps/web` participant + leader MVP** SHOULD depend on:

### Auth / session

- `POST /api/v2/auth/web/session` — bootstrap workspace session

### Tours (participant + leader)

- `GET /api/v2/tours` — list/catalog
- `GET /api/v2/tours/{tourId}` — detail

### Participant placement (**canonical path per this contract**)

- `POST /api/v2/tours/{tourId}/register` — **preferred** placement mutation
- `POST /api/v2/tours/{tourId}/waitlist` — **preferred** explicit waitlist on capacity-full (when UX uses public-aligned API)

### Authenticated adjuncts (**allowed transitional / parallel** until FE migrated)

- `POST /api/v2/registrations` — authenticated full intake (**current implementation**)
- `POST /api/v2/bookings` — authenticated shortcut (**optional** replacement for register when mapping is acceptable)

### Participant tracking / bookings UX

- `GET /api/v2/bookings` — list participant bookings (current list page)
- `GET /api/v2/registrations/{registrationId}` — detail + polling for status/payment aggregates

### Payment (participant)

- **`POST /api/v2/payments/intent`** — when payment is required **after placement**

### Leader / ops (already used by FE)

- `GET /api/v2/tours/{tourId}/registrations`
- `GET /api/v2/tours/{tourId}/waitlist-items`
- `PATCH /api/v2/registrations/{registrationId}/status`
- `PATCH /api/v2/registrations/{registrationId}/payment`
- `POST /api/v2/waitlist-items/{waitlistItemId}/convert`

### Deferred / tooling (not baseline participant MVP)

- `POST /api/v2/waitlist-items/{waitlistItemId}/cancel`
- **`/api/v2/admin/payments*`** — operator dashboards / investigations unless product mandates

### Explicitly absent from OpenAPI (do NOT treat as contractual today)

Wireflows cite **`GET /api/v2/dashboard/leader-workspace`** and **`GET /api/v2/reconciliation/export.csv`** — **not defined in current `openapi.json`**. Frontend must avoid hard dependency until backend publishes them **or** product retires journeys.

---

## SECTION 5 — Downstream documentation actions (non-code)

Owners MUST update **`wireflows_must_have_journeys_v2.md` J-P-01**:

- Align primary touchpoints with **`POST /tours/{tourId}/register`** (+ waitlist `/tours/.../waitlist`) OR clearly scope **`POST /registrations`** as authenticated-only appendix.
- Remove blanket **initial `Pending`** claim if binding path is **`Accepted`** on successful placement under runtime semantics.

---

# PHASE 5 — Implementation impact preview (apps/web only)

Do **NOT** refactor until product signs this contract subsection.

Likely impacted files grouped by responsibility:

### Registration funnel

- `apps/web/app/(app)/tours/[id]/register/register-for-tour-client.tsx` — switch primary mutation (`register`/`waitlist` vs `registrations`/`waitlist-items`), update success UX copy & tests.
- `apps/web/lib/services/registrations.service.ts` — add `publicRegisterTour` / `publicWaitlistTour` helpers alongside existing functions; unify normalization for mixed response shapes (`register` 201 loosely typed vs `RegistrationResponseDto`).
- `apps/web/tests/smoke/pre-release-flow.spec.ts` — align route mocks.

### Participant tracking / payment UX

- `apps/web/app/(app)/bookings/booking-detail-client.tsx` (+ `booking-badges`, `formatters`) — expose payment pending vs registration accepted semantics; eventual intent handoff UX.
- `apps/web/lib/services/payments.service.ts` (**new**) — encapsulate **`POST /payments/intent`**.
- Possibly `packages/types` — tighten types if `register` response contracts get formalized backend-side.

### Bookings UX consistency

- `apps/web/app/(app)/bookings/bookings-list-view.tsx` — ensure list coherence if placement ID source changes purely waitlist acknowledgement flows.
- `apps/web/lib/services/bookings.service.ts` — reconcile **`createBooking` dead helper** vs new canonical flow (either wire or delete).

### React Query choreography

- `apps/web/lib/query-keys.ts` — possible payment keys & public-register cache slices.
- `apps/web/app/(app)/leader/review/*.tsx`, `apps/web/app/(app)/tours/[id]/workspace/*.tsx`, `apps/web/app/(app)/register...` — invalidated queries may need widening when placements shift endpoints.

### Product honesty / scaffolding

- `apps/web/app/auth/register/register-form.tsx` — onboarding vs disabled banner should reference this contract.


---

## Sign-off checklist

Product + Backend + Frontend leads must checkbox:

- [ ] Accept **Phase 1** canonical placement endpoints for web MVP.
- [ ] Accept Phase 2 **async payment polling** anchored on **`GET registrations/{id}`** after **`POST payments/intent`**.
- [ ] Accept Telegram **engineering phase split** (`Phase 2` default stance).
- [ ] Schedule wireflow textual amendments to remove contradictions versus this document.
