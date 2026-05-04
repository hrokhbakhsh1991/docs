# Frontend Mock Server Specification (FE Contract)

This document defines a **deterministic mock HTTP interface** for frontend development. It is derived only from:

- `docs/10-product/frontend_readiness_tasks.md` — **Section J** (Screen → API Mapping Matrix)
- `apps/api/openapi.json` — paths, methods, and component schemas

It is **not** backend implementation documentation. Do not treat mock behavior as production truth beyond schema shapes and enums reflected in OpenAPI.

---

## 1. Introduction

### Goals

- Allow the FE team to build and test flows **without blocking on a live backend**.
- Provide **predictable** responses that match **`apps/api/openapi.json`** shapes (DTOs, enums, error envelopes).
- Support both **static fixtures** (fixed JSON files) and **dynamic mocks** (in-memory store with transitions).
- Mirror **Section J** coverage so every route the FE expects to call has a mock contract.

### Non-goals

- Defining new REST routes or business rules not implied by OpenAPI + Section J.
- Replacing contract tests against the real API or E2E environments.

### References

| Document | Role |
|----------|------|
| `docs/10-product/frontend_readiness_tasks.md` § **J** | Which screens map to which endpoints |
| `apps/api/openapi.json` | Authoritative path/method/schema surface |

---

## 2. Principles of Mocking

1. **GET idempotency:** Repeated `GET` requests for the same resource return the same logical snapshot unless the mock state machine advances (see §6).
2. **Deterministic fixtures:** Use stable UUIDs and amounts in examples so snapshots and Playwright traces stay reproducible.
3. **Multi-state resources:** Registration, Payment, and Waitlist entities must be mockable in all enum states exposed by OpenAPI (`RegistrationResponseDto.status`, `PaymentResponseDto.status`, `WaitlistItemResponseDto.status`).
4. **Mutations advance state:** `POST`, `PATCH`, and scenario hooks (see below) update in-memory entities so subsequent `GET`s reflect the new state.
5. **Async payment UX:** Simulate webhook/async delays with **delayed transitions** (e.g. after `POST /api/v2/payments/intent`, optionally schedule a timer that flips `Payment.status` from `Pending` to `Paid` or `Failed`, then align `Registration.status` per `docs/runtime-lifecycle.md` — same semantics as **Sections B4, H, I** in `frontend_readiness_tasks.md`).
6. **No phantom routes:** Do not implement stable mocks for paths that are **TODO / missing** in OpenAPI (§4 and §7) except as **explicit stubs** returning **501** or documented placeholder JSON for local UX — label those **TODO** clearly.

---

## 3. Global Conventions

### 3.1 Timestamps

- Use **ISO 8601** strings in UTC for instant fields, e.g. `2026-05-02T10:00:00.000Z`, matching OpenAPI examples on DTOs (`createdAt`, `updatedAt`, `paidAt`, etc.).

### 3.2 Money / amounts

- OpenAPI uses **`string`** for monetary fields on **`PaymentResponseDto`** (`amount`, etc.) and **`RegistrationResponseDto.paidAmount`** — mocks should use **string decimals** (e.g. `"2500000"`) to match the contract, not raw numbers, unless a specific schema says `number`.

### 3.3 Core entity schemas (OpenAPI component refs)

Implement mock JSON bodies that validate against these schemas in `apps/api/openapi.json`:

| Concept | Schema component |
|---------|------------------|
| Tour (read) | `TourResponseDto` |
| Tour (partial update) | `UpdateTourDto` |
| Registration (read) | `RegistrationResponseDto` |
| Registration (create body) | `CreateRegistrationDto` |
| Waitlist item (read) | `WaitlistItemResponseDto` |
| Waitlist (create body) | `CreateWaitlistItemDto` |
| Payment (read) | `PaymentResponseDto` |
| Payment intent (create body) | `CreatePaymentIntentDto` |
| Registration status patch | `UpdateRegistrationStatusDto` |
| Registration payment patch | `UpdateRegistrationPaymentDto` |
| Refund request | `RefundPaymentDto` |
| Webhook payload | `PaymentWebhookDto` |
| Error envelope | `ErrorResponseDto` / `ErrorBodyDto` |

### 3.4 Error responses

Align mock errors with **`ErrorResponseDto`**:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "retryability": "NO_RETRY",
    "details": {}
  },
  "requestId": "req_mock_001"
}
```

Typical HTTP mapping for mocks:

| HTTP | When | Example `error.code` (non-exhaustive) |
|------|------|--------------------------------------|
| **400** | Validation / bad input | `VALIDATION_FAILED` (per OpenAPI registration/payment operation descriptions) |
| **401** | Missing/invalid bearer | `AUTH_*` (see OpenAPI response descriptions) |
| **403** | Role / tenant | `AUTH_FORBIDDEN_ROLE`, `TENANT_*` |
| **409** | **TODO:** confirm idempotency / conflict codes from product error taxonomy — use a stable mock code if needed | **TODO** |
| **500** | Simulated outage | `INTERNAL_ERROR` or taxonomy equivalent — **TODO:** confirm |

### 3.5 Pagination

- **`GET /api/v2/tours`** returns an **array** of `TourResponseDto` with **no** pagination fields in OpenAPI — mocks should return a plain JSON array.
- **`GET /api/v2/admin/payments`** returns **`PaymentResponseDto[]`** with **`parameters: []`** in OpenAPI — no documented `limit`/`cursor`; mock as a finite array unless product extends the contract (**TODO**).

### 3.6 Auth headers

- Operations under `security: bearer` in OpenAPI expect **`Authorization: Bearer <token>`**. Mocks may accept any non-empty token for happy paths.

---

## 4. Endpoint Definitions (Grouped by Section J)

Paths and methods below are exactly those implied by **Section J** and present in **`apps/api/openapi.json`**, unless marked **TODO** (missing from OpenAPI).

For each entry:

- **Exists in OpenAPI:** YES / NO / PARTIAL (see notes).
- **Mock Response Example:** illustrative JSON; must conform to the referenced schema when **YES**.

---

### J1 — Dashboard / Leader Workspace

#### `GET /api/v2/tours`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **YES** (`ToursController_list`) |
| **Method** | GET |
| **Mock Response Example** | Array of `TourResponseDto` |

> **Note:** Tour dates were removed from the MVP domain model. Older mock specifications may still reference them.

```json
[
  {
    "id": "22222222-2222-4222-8222-222222222222",
    "createdAt": "2026-05-02T10:00:00.000Z",
    "updatedAt": "2026-05-02T10:00:00.000Z",
    "title": "Spring Camp 2026",
    "description": "Mock tour",
    "totalCapacity": 30,
    "acceptedCount": 10,
    "lifecycleStatus": "OPEN",
    "chatLink": "https://t.me/joinchat/mock-example",
    "costContext": { "currency": "IRR", "requiresPayment": true }
  }
]
```

**Stateful behavior:** Optional filter by tenant in real backend; mock may ignore auth and return the seeded list.

---

#### `GET /api/v2/tours/{tourId}`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **YES** (`ToursController_getById`) |
| **Method** | GET |
| **Mock Response Example** | Single `TourResponseDto` |

> **Note:** Tour dates were removed from the MVP domain model. Older mock specifications may still reference them.

```json
{
  "id": "22222222-2222-4222-8222-222222222222",
  "createdAt": "2026-05-02T10:00:00.000Z",
  "updatedAt": "2026-05-02T10:00:00.000Z",
  "title": "Spring Camp 2026",
  "description": "Mock tour",
  "totalCapacity": 30,
  "acceptedCount": 10,
  "lifecycleStatus": "OPEN",
  "chatLink": "https://t.me/joinchat/mock-example",
  "costContext": { "currency": "IRR", "requiresPayment": true }
}
```

**Stateful behavior:** `acceptedCount` may decrease/increase when mock registration/waitlist/payment state changes (optional simulation).

---

#### `GET /api/v2/admin/payments`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **YES** (`PaymentsController_listPayments`) |
| **Method** | GET |
| **Mock Response Example** | `PaymentResponseDto[]` |

```json
[
  {
    "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "tenantId": "11111111-1111-4111-8111-111111111111",
    "registrationId": "33333333-3333-4333-8333-333333333333",
    "amount": "2500000",
    "currency": "IRR",
    "provider": "mock_provider",
    "providerPaymentId": "mock-pay-001",
    "status": "Pending",
    "paidAt": null,
    "failedAt": null,
    "refundedAt": null,
    "createdAt": "2026-05-02T10:00:00.000Z",
    "updatedAt": "2026-05-02T10:00:00.000Z"
  }
]
```

**Stateful behavior:** Return all seeded payments for the mock store; **TODO:** OpenAPI has no query params — filtering by `registrationId` in mocks is **non-contract** unless BE adds parameters.

---

#### Leader dashboard aggregate / `GET …/dashboard/…`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **NO** — Section J notes absence (**TODO**) |
| **Method** | GET (hypothetical) |
| **Mock** | **TODO:** stub only — e.g. `501 Not Implemented` or static JSON **not** backed by OpenAPI until backend exposes a path |

---

#### `GET /api/v2/registrations` (list)

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **NO** — only **`POST /api/v2/registrations`** is defined for that path |
| **Method** | GET (desired by UX; **not** in contract) |
| **Mock** | **TODO:** see §7 |

---

### J2 — Public Registration Flow

#### `POST /api/v2/tours/{tourId}/register`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **YES** (`RegistrationsController_publicRegister`) |
| **Method** | POST |
| **Request** | `CreateRegistrationDto` |
| **Response** | OpenAPI **`201`** with `additionalProperties: true` — body shape **not** fully fixed in schema |

**Mock Response Example (201)** — illustrative; keys **TODO** vs real backend:

```json
{
  "registration": {
    "id": "33333333-3333-4333-8333-333333333333",
    "tenantId": "11111111-1111-4111-8111-111111111111",
    "tourId": "22222222-2222-4222-8222-222222222222",
    "participantFullName": "Ali Ahmadi",
    "participantContactPhone": "+989121234567",
    "transportMode": "group_vehicle",
    "entryMode": "web",
    "status": "Accepted",
    "paymentStatus": "NotPaid",
    "paidAmount": "0",
    "createdAt": "2026-05-02T10:00:00.000Z",
    "updatedAt": "2026-05-02T10:00:00.000Z"
  }
}
```

**Stateful behavior:** Insert registration into mock store; if simulating capacity full, return waitlist-shaped payload per **Section J** / runtime (**TODO:** exact keys for waitlist branch).

---

#### `POST /api/v2/registrations`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **YES** (`RegistrationsController_createRegistration`) |
| **Method** | POST |
| **Headers** | `idempotency-key` required |
| **Request** | `CreateRegistrationDto` |
| **Response** | `201` + `RegistrationResponseDto` |

**Mock Response Example:**

```json
{
  "id": "33333333-3333-4333-8333-333333333333",
  "tenantId": "11111111-1111-4111-8111-111111111111",
  "tourId": "22222222-2222-4222-8222-222222222222",
  "participantFullName": "Ali Ahmadi",
  "participantContactPhone": "+989121234567",
  "transportMode": "group_vehicle",
  "entryMode": "web",
  "telegramUserId": null,
  "telegramUsername": null,
  "vehicleSeatCapacity": null,
  "participantNote": null,
  "status": "Accepted",
  "paymentStatus": "NotPaid",
  "paidAmount": "0",
  "payment": null,
  "createdAt": "2026-05-02T10:00:00.000Z",
  "updatedAt": "2026-05-02T10:00:00.000Z"
}
```

---

#### `POST /api/v2/payments/intent`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **YES** (`PaymentsController_createPaymentIntent`) |
| **Method** | POST |
| **Headers** | `Idempotency-Key` required |
| **Request** | `CreatePaymentIntentDto` |
| **Response** | `201` + `PaymentResponseDto` |

**Mock Response Example:**

```json
{
  "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "tenantId": "11111111-1111-4111-8111-111111111111",
  "registrationId": "33333333-3333-4333-8333-333333333333",
  "amount": "2500000",
  "currency": "IRR",
  "provider": "mock_provider",
  "providerPaymentId": "mock-pay-001",
  "status": "Pending",
  "paidAt": null,
  "failedAt": null,
  "refundedAt": null,
  "createdAt": "2026-05-02T10:00:10.000Z",
  "updatedAt": "2026-05-02T10:00:10.000Z"
}
```

**Stateful behavior:** Optionally schedule delayed transition to `Paid` or `Failed` (§6).

---

#### `GET /api/v2/registrations/{registrationId}`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **YES** (`RegistrationsController_getRegistrationById`) |
| **Method** | GET |
| **Response** | `RegistrationResponseDto` (may include nested `payment` object per schema) |

**Mock Response Example (`Accepted` + pending payment):**

```json
{
  "id": "33333333-3333-4333-8333-333333333333",
  "tenantId": "11111111-1111-4111-8111-111111111111",
  "tourId": "22222222-2222-4222-8222-222222222222",
  "participantFullName": "Ali Ahmadi",
  "participantContactPhone": "+989121234567",
  "transportMode": "group_vehicle",
  "entryMode": "web",
  "status": "Accepted",
  "paymentStatus": "NotPaid",
  "paidAmount": "0",
  "payment": {
    "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "status": "Pending",
    "amount": "2500000",
    "currency": "IRR"
  },
  "createdAt": "2026-05-02T10:00:00.000Z",
  "updatedAt": "2026-05-02T10:00:10.000Z"
}
```

**Note:** Nested `payment` shape in `RegistrationResponseDto` follows OpenAPI `payment` property example — keep consistent with `PaymentResponseDto` fields where applicable.

---

#### `GET /api/v2/admin/payments/{id}`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **YES** (`PaymentsController_getPayment`) |
| **Method** | GET |
| **Response** | `PaymentResponseDto` |

Same shape as single element of `GET /api/v2/admin/payments`.

---

#### `GET /api/v2/payments/{id}` (non-admin)

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **NO** — Section J explicit **TODO** |
| **Mock** | Do not implement as a real contract route; use **`GET /api/v2/registrations/{registrationId}`** for participant polling |

---

### J3 — Payment Result Surfaces

Same endpoints as **J2** for polling:

- **`GET /api/v2/registrations/{registrationId}`** — primary participant poll (**YES**).
- **`GET /api/v2/admin/payments/{id}`** — admin diagnostic (**YES**).

#### `POST /internal/payments/webhook`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **YES** (`PaymentsWebhookController_webhook`) |
| **Method** | POST |
| **Headers** | `X-Internal-Api-Key` required |
| **Request** | `PaymentWebhookDto` |

**Mock usage:** For integration-style mocks, FE tools normally **do not** call this from the browser; wire **server-side** mock or test harness to flip payment state. OpenAPI summary states webhook is idempotent and **always returns 200** at HTTP layer — replicate that in mock if simulating.

**Stateful behavior:** On ingest, update mock `Payment` + `Registration` per runtime transitions (**Sections B4 / H**).

---

### J4 — Waitlist Flows

#### `POST /api/v2/tours/{tourId}/waitlist`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **YES** (`RegistrationsController_publicWaitlist`) |
| **Method** | POST |
| **Response** | OpenAPI schema: `waitlistItemId`, `queuePosition` |

```json
{
  "waitlistItemId": "44444444-4444-4444-8444-444444444444",
  "queuePosition": 3
}
```

---

#### `POST /api/v2/waitlist-items`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **YES** (`RegistrationsController_createWaitlistItem`) |
| **Method** | POST |
| **Headers** | `idempotency-key` required |
| **Request** | `CreateWaitlistItemDto` |
| **Response** | `201` + `WaitlistItemResponseDto` |

**Mock Response Example:**

```json
{
  "id": "44444444-4444-4444-8444-444444444444",
  "tenantId": "11111111-1111-4111-8111-111111111111",
  "tourId": "22222222-2222-4222-8222-222222222222",
  "participantFullName": "Sara Mohammadi",
  "participantContactPhone": "+989351112233",
  "transportMode": "other",
  "entryMode": "telegram",
  "status": "Waiting",
  "conversionReason": null,
  "cancelReason": null,
  "createdAt": "2026-05-02T10:05:00.000Z",
  "updatedAt": "2026-05-02T10:05:00.000Z"
}
```

---

#### `POST /api/v2/waitlist-items/{waitlistItemId}/convert`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **YES** (`RegistrationsController_convertWaitlistItem`) |
| **Method** | POST |
| **Optional body** | `ConvertWaitlistItemDto` |
| **Response** | `WaitlistItemResponseDto` |

**Stateful behavior:** Set item `status` to `Converted`; seed or link `Registration` with `Accepted` — **TODO:** confirm linkage fields with backend.

---

#### `POST /api/v2/waitlist-items/{waitlistItemId}/cancel`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **YES** (`RegistrationsController_cancelWaitlistItem`) |
| **Method** | POST |
| **Optional body** | `CancelWaitlistItemDto` |
| **Response** | `WaitlistItemResponseDto` (`status`: `Cancelled`) |

---

#### `GET /api/v2/waitlist-items/{waitlistItemId}`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **NO** — Section J **TODO** |
| **Mock** | **TODO:** stub only (§7) or derive state from leader-only lists (**TODO** backend list endpoint) |

---

#### `GET /api/v2/registrations/{registrationId}` (post-promotion)

Same as J2 — poll registration after promotion.

---

### J5 — Admin / Leader Overrides

#### `PATCH /api/v2/registrations/{registrationId}/status`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **YES** (`RegistrationsController_updateRegistrationStatus`) |
| **Method** | PATCH |
| **Request** | `UpdateRegistrationStatusDto` (`targetStatus` enum) |
| **Response** | `RegistrationResponseDto` |

**Stateful behavior:** Map `targetStatus` to stored registration; align payment snapshot if rule requires (**TODO:** product).

---

#### `PATCH /api/v2/registrations/{registrationId}/payment`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **YES** (`RegistrationsController_updateRegistrationPayment`) |
| **Method** | PATCH |
| **Request** | `UpdateRegistrationPaymentDto` |

---

#### `POST /api/v2/admin/payments/{id}/refund`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **YES** (`PaymentsController_refundPayment`) |
| **Method** | POST |
| **Headers** | `Idempotency-Key` required |
| **Body** | `RefundPaymentDto` |
| **Response** | `PaymentResponseDto` |

**Stateful behavior:** Set payment toward `Refunded`; align `Registration.status` per runtime (**Section H**).

---

#### `PATCH /api/v2/tours/{tourId}`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **YES** (`ToursController_update`) |
| **Method** | PATCH |
| **Headers** | `Idempotency-Key` required |
| **Request** | `UpdateTourDto` |
| **Response** | `TourResponseDto` |

**TODO:** Which fields update capacity vs metadata — align with **Section D2** / OpenAPI field names (`total_capacity` on update vs `totalCapacity` on read).

---

### J6 — Exports / Reports

#### `GET /api/v2/reconciliation/export.csv`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **NO** — Section J **TODO** |
| **Mock** | **TODO:** return `text/csv` placeholder or **501** |

---

#### `GET /api/v2/reconciliation/export-waitlist.csv`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **NO** — Section J **TODO** |
| **Mock** | **TODO:** same as above |

---

### J7 — Session / Supporting APIs & Missing UX (from Section J)

Section J lists additional **session** routes required for **Section G**-style flows. These **are** in OpenAPI:

#### `POST /api/v2/auth/web/session`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **YES** |
| **Method** | POST |
| **Request** | `WebSessionDto` |
| **Response** | `WebSessionResponseDto` |

```json
{
  "session_token": "mock_session_jwt",
  "user_id": "user_mock_1",
  "tenant_id": "11111111-1111-4111-8111-111111111111",
  "entry_mode": "web"
}
```

---

#### `POST /api/v2/auth/telegram/session`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **YES** |
| **Method** | POST |
| **Request** | `TelegramSessionDto` |
| **Response** | `TelegramSessionResponseDto` |

---

#### `POST /api/v2/auth/link-telegram`

| Field | Value |
|-------|--------|
| **Exists in OpenAPI** | **YES** |
| **Method** | POST |
| **Request** | `LinkTelegramDto` |
| **Response** | `LinkTelegramResponseDto` |

---

**Section J7 TODO bullets** (product gaps, not necessarily missing paths) are consolidated in **§7**.

---

## 5. Example Mock Payloads

### 5.1 Registration (`RegistrationResponseDto`)

| `status` | Use case |
|----------|----------|
| `Accepted` | After successful capacity registration |
| `AcceptedPaid` | After payment success |
| `Rejected` | Payment failed or manual reject |
| `Cancelled` | Manual cancel |
| `Refunded` | Refund completed |
| `Pending` | **TODO:** non-public flows — schema allows |
| `NoShow` | Ops outcome |

Minimal **`AcceptedPaid`** example:

```json
{
  "id": "33333333-3333-4333-8333-333333333333",
  "tenantId": "11111111-1111-4111-8111-111111111111",
  "tourId": "22222222-2222-4222-8222-222222222222",
  "participantFullName": "Ali Ahmadi",
  "participantContactPhone": "+989121234567",
  "transportMode": "group_vehicle",
  "entryMode": "web",
  "status": "AcceptedPaid",
  "paymentStatus": "Paid",
  "paidAmount": "2500000",
  "payment": null,
  "createdAt": "2026-05-02T10:00:00.000Z",
  "updatedAt": "2026-05-02T10:02:00.000Z"
}
```

### 5.2 Payment (`PaymentResponseDto`)

| `status` | Notes |
|----------|--------|
| `Pending` | Before webhook |
| `Paid` | Terminal success path for payment entity |
| `Failed` | Terminal |
| `Refunded` | Terminal |
| `Cancelled` | Terminal |

### 5.3 Waitlist (`WaitlistItemResponseDto`)

| `status` | Notes |
|----------|--------|
| `Waiting` | Initial queue |
| `Converted` | After promotion |
| `Cancelled` | Cancelled entry |

### 5.4 Dashboard aggregate objects

**TODO:** No OpenAPI schema for a combined “leader workspace” payload — use **composed** mocks built from `TourResponseDto[]`, `PaymentResponseDto[]`, and **TODO** registration list until **`GET /api/v2/registrations`** exists.

---

## 6. State Machines for Mock Data

These mirror **`docs/runtime-lifecycle.md`** and the FE contract summaries in **`frontend_readiness_tasks.md`** (**Sections B4, C3, D4, H, I**). Mocks should implement **optional** timers for async steps.

### 6.1 Payment lifecycle (`Payment.status`)

```
Pending → Paid
Pending → Failed
Paid    → Refunded
Paid    → Cancelled
(Failed | Refunded | Cancelled terminal)
```

**Mock delay:** After intent creation, `setTimeout` → apply webhook logic or direct state flip.

### 6.2 Registration lifecycle (`Registration.status`) — excerpt

Public success path:

```
→ Accepted → AcceptedPaid (on Paid)
→ Accepted → Rejected (on Failed or manual)
Accepted → Cancelled (manual)
AcceptedPaid → Refunded | Cancelled | Rejected (per runtime doc)
```

### 6.3 Waitlist lifecycle (`WaitlistItem.status`)

```
Waiting → Converted
Waiting → Cancelled
(Converted | Cancelled terminal in operational flow)
```

### 6.4 Admin override effects (mock)

- **`PATCH …/status`** and **`PATCH …/payment`** jump registration (and optionally linked payment) to target enums.
- **`PATCH /api/v2/tours/{tourId}`** may change `totalCapacity` — **TODO:** simulate promotion of waitlist in mock only if product rules are confirmed (**Section D2**).

---

## 7. TODO List (Backend-Missing APIs)

Endpoints or capabilities referenced in **`frontend_readiness_tasks.md` Section J** that are **not** present in **`apps/api/openapi.json`** (or are incomplete for UX):

| # | Item | Section J ref |
|---|------|----------------|
| 1 | **Leader dashboard aggregate** — no `GET …/dashboard…` / `leader-workspace` | J1 |
| 2 | **`GET /api/v2/registrations`** (list with filters) — only **`POST`** exists on `/api/v2/registrations` | J1, J7 |
| 3 | **`GET /api/v2/payments/{id}`** (participant, non-admin) — not in OpenAPI | J2 |
| 4 | **`GET /api/v2/waitlist-items/{waitlistItemId}`** — not in OpenAPI | J4, J7 |
| 5 | **`GET /api/v2/reconciliation/export.csv`** — not in OpenAPI | J6 |
| 6 | **`GET /api/v2/reconciliation/export-waitlist.csv`** — not in OpenAPI | J6 |
| 7 | **Public anonymous tour marketing read** — **`GET /api/v2/tours/{tourId}`** exists but Section J7 flags **TODO** for anonymous/marketing use | J7 |
| 8 | **Filter/query params on `GET /api/v2/admin/payments`** — OpenAPI `parameters: []` | J7 |
| 9 | **Dedicated cancel-registration mutation** — Section J7 says verify **`PATCH …/status`** vs new route | J7 |

**Open items that are product clarification (may map to existing PATCH):**

- **TODO:** Confirm embedded `payment` on **`GET /api/v2/registrations/{id}`** is sufficient for all participant payment UX (**Section J7**).
- **TODO:** **`409`** / idempotency error shapes — align with error taxonomy when documented.

---

## Revision history

| Date | Change |
|------|--------|
| — | Initial `frontend_mock_server_spec.md` from Section J + `apps/api/openapi.json`. |
