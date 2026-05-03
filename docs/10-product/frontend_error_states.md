# Frontend Error State Matrix (FE Contract)

## Purpose

Define **how the frontend must behave** when things go wrong across:

- **Registration** (public and authenticated)
- **Payment** (async confirmation, gateway return, polling)
- **Waitlist** (placement, promotion, conversion)
- **Dashboard / leader / admin** surfaces
- **Network and session** failures
- **Capacity contention** and **stale UI** after remote changes

**Sources (no new backend behavior invented here):**

- `docs/10-product/frontend_readiness_tasks.md` — **Section J** (screen → API), **Sections B–G** (payment async, waitlist/capacity, idempotency, session/network)
- `apps/api/openapi.json` — HTTP methods, documented response codes where present, **`ErrorResponseDto`** / **`ErrorBodyDto`**

When OpenAPI does **not** enumerate a status code or `error.code`, this document uses **`TODO`** and still specifies **user-visible behavior** the FE should implement deterministically.

---

## (1) Principles

1. **Deterministic surfaces:** Every failure path maps to a **named UX outcome** (banner, full-page state, or inline field errors)—never a blank screen.
2. **No generic “Unknown error”:** Always derive copy from **`error.code`** + **`error.message`** + HTTP status when present; if the body is missing, use a **standard fallback** copy keyed by HTTP status and retryability (**TODO:** finalize copy deck).
3. **Stable categories** — group handling logic as follows:

   | # | Category | Typical HTTP (when documented) | FE strategy |
   |---|-----------|---------------------------------|-------------|
   | 1 | **Validation** | **400** — OpenAPI lists `VALIDATION_FAILED`, `VALIDATION_ENUM_INVALID` on several routes | Inline / summary errors from `error.details.field_errors` when present |
   | 2 | **Authentication / session** | **401** — `AUTH_*`; **403** — `TENANT_*`, `AUTH_FORBIDDEN_ROLE` (per OpenAPI operation descriptions) | Re-auth flow, permission messaging (**Section G1**) |
   | 3 | **Not found** | **404** — documented on multiple `GET`/`PATCH`/`POST` sub-resources | Empty state + safe navigation back |
   | 4 | **Conflict / race / idempotency** | **TODO:** **409** not enumerated in sampled `apps/api/openapi.json` paths — still required UX for idempotency replay and concurrency (**Sections C1, E1**) | Safe retry, refresh state, explain “someone else took the seat” when code implies capacity conflict |
   | 5 | **Payment domain** | Not always HTTP-visible: **`Payment.status`** transitions (**Section B**) | Drive **WF-PAY-ASYNC-01** / **WF-PAY-FAIL-01**, not only status codes |
   | 6 | **Waitlist conversion conflicts** | Mix of **404** / **403** / **TODO** conflict codes on convert/cancel | Refresh waitlist + registration reads (**Section C2**) |
   | 7 | **Capacity lost during submit** | **TODO:** `CAPACITY_FULL` / `CONCURRENCY_CONFLICT` referenced in **Section A2.1** / **C1** — confirm HTTP mapping | Explain tour full or seat lost; offer waitlist / refresh (**Section C**) |
   | 8 | **Network** | Transport failure (no JSON body) | Retry with backoff; distinguish offline if product adopts **Section G2** |
   | 9 | **Admin override mismatch** | Often **200** on reads with **different** body than optimistic UI (**Section D4**) | Non-modal **“Updated by organizer”** pattern + replace local state from **`GET`** |

4. **Envelope:** Prefer parsing **`ErrorResponseDto`**: `error.code`, `error.message`, `error.retryability`, `error.details`, `requestId` (**OpenAPI components**).

---

## (2) Error Matrix Table

Legend for **Backend status code**:

- **doc** = listed under that operation in `apps/api/openapi.json`
- **runtime** = domain state from **`Registration` / `Payment` / `WaitlistItem`** (not an HTTP code)
- **TODO** = not enumerated in OpenAPI for that operation; confirm with backend / error taxonomy

### J1 — Dashboard / Leader Workspace

| Screen | API | Error / situation | Backend status code | User-facing behavior | Notes |
|--------|-----|-------------------|----------------------|------------------------|-------|
| Tours index | `GET /api/v2/tours` | Unauthorized | **401** doc | Login / refresh session (**G1**) | OpenAPI `AUTH_*` |
| Tours index | `GET /api/v2/tours` | Forbidden (wrong tenant/role) | **403** doc | Explain no access; link support | `TENANT_*`, `AUTH_FORBIDDEN_ROLE` |
| Tours index | `GET /api/v2/tours` | Network failure | — (transport) | Retry banner; offline variant **TODO** (**G2**) | No `ErrorResponseDto` |
| Tour detail | `GET /api/v2/tours/{tourId}` | Not found | **404** doc | “Tour not found”; back to list | |
| Tour detail | `GET /api/v2/tours/{tourId}` | Unauthorized / Forbidden | **401** / **403** doc | Same as tours index | |
| Admin payments list | `GET /api/v2/admin/payments` | Unauthorized / Forbidden | **401** / **403** doc | Session / role messaging | OpenAPI security bearer |
| Leader dashboard (aggregate) | **TODO:** no OpenAPI path (**Section J1**) | N/A | **TODO** | Use composed screens from available GETs or stub | **Section A1** |
| Registrations table | **TODO:** no `GET /api/v2/registrations` list (**Section J1**) | N/A | **TODO** | Cannot match production contract—show **“data unavailable”** in mock-only builds | Product/BE ticket |

### J2 — Public Registration Flow

| Screen | API | Error / situation | Backend status code | User-facing behavior | Notes |
|--------|-----|-------------------|----------------------|------------------------|-------|
| Public register form | `POST /api/v2/tours/{tourId}/register` | Validation | **400** doc | Field errors + summary | `VALIDATION_FAILED`, `VALIDATION_ENUM_INVALID` |
| Public register form | `POST /api/v2/tours/{tourId}/register` | Capacity full / race | **TODO** — **Section C1** suggests `CAPACITY_FULL` / contention | Branch to waitlist journey or “tour full” copy | May not be **409** in API—map by `error.code` when known |
| Public register form | `POST /api/v2/tours/{tourId}/register` | Last seat lost during submit | **TODO** | Same as contention—refresh tour capacity + retry guidance | **Section C1** |
| Authenticated create | `POST /api/v2/registrations` | Validation | **400** doc | Same as public | Requires `idempotency-key` header |
| Authenticated create | `POST /api/v2/registrations` | Idempotency replay mismatch | **TODO** (**Section E1**) | Do not double-charge UX: explain safe retry with **same** key vs **new** submission | Confirm `IDEMPOTENCY_KEY_REPLAY_MISMATCH` |
| Payment intent | `POST /api/v2/payments/intent` | Validation | **TODO** — OpenAPI **only documents `201`** for this operation | Standard validation UI | **Gap:** add error responses to OpenAPI |
| Payment intent | `POST /api/v2/payments/intent` | Unauthorized | **TODO** — not in operation list | Login | Bearer required |
| Payment intent | `POST /api/v2/payments/intent` | Duplicate pending intent / business rule | **TODO** | Message + link to existing payment poll (**B4** duplicate row) | **Section B4** |
| Registration poll | `GET /api/v2/registrations/{registrationId}` | Not found | **404** doc | “Registration not found”; verify link/deep link | |
| Registration poll | `GET /api/v2/registrations/{registrationId}` | Unauthorized / Forbidden | **401** / **403** doc | Session / tenant (**G1**) | |
| Admin payment diagnostic | `GET /api/v2/admin/payments/{id}` | Not found | **404** doc | Admin empty state | |

### J3 — Payment Result Surfaces

| Screen | API | Error / situation | Backend status code | User-facing behavior | Notes |
|--------|-----|-------------------|----------------------|------------------------|-------|
| Pending confirmation UI | `GET /api/v2/registrations/{registrationId}` | **`Payment.status` still `Pending`** | **runtime** | **WF-PAY-ASYNC-01**: “Confirming payment…” + polling + **Refresh** | **Section B2** |
| Pending too long | Poll same GET | Pending exceeds policy threshold | **runtime** | Non-blocking banner + support link + manual refresh; **TODO:** SLA | **Section B2** |
| Payment failed | Poll GET | **`Payment.status` → `Failed`**, registration **`Rejected`** | **runtime** | **WF-PAY-FAIL-01** full state + seat released copy | **Section B3** |
| Payment cancelled | Poll GET / admin GET | **`Payment.status` → `Cancelled`** | **runtime** | Cancelled messaging; **TODO:** registration mapping (**Section D3**) | **Section H2** |
| Network loss on return from gateway | Poll GET | Transport error | — | Retry backoff; stay on pending shell (**G2**) | User may land mid-flow |
| Internal webhook | `POST /internal/payments/webhook` | N/A for browser | — | FE does not call; test harness only | **Section B2** |

### J4 — Waitlist Flows

| Screen | API | Error / situation | Backend status code | User-facing behavior | Notes |
|--------|-----|-------------------|----------------------|------------------------|-------|
| Join waitlist (public) | `POST /api/v2/tours/{tourId}/waitlist` | Validation | **TODO** — errors not fully listed on this op in sample | Inline validation | Confirm OpenAPI |
| Join waitlist (public) | `POST /api/v2/tours/{tourId}/waitlist` | Unauthorized | **TODO** | If route is public, should not occur—confirm | OpenAPI: no bearer on public register path pattern |
| Create waitlist item | `POST /api/v2/waitlist-items` | Validation / auth | **400** / **401** / **403** doc | Standard | OpenAPI lists these |
| Convert | `POST /api/v2/waitlist-items/{waitlistItemId}/convert` | Not found / wrong state | **404** / **400** doc | “Entry not available”; refresh list | Leader-only |
| Convert | `POST /api/v2/waitlist-items/{waitlistItemId}/convert` | Forbidden | **403** doc | Role messaging | |
| Cancel waitlist | `POST /api/v2/waitlist-items/{waitlistItemId}/cancel` | Not found | **404** doc | Already gone—refresh | |
| Waitlist detail | **TODO:** no `GET …/waitlist-items/{id}` (**Section J4**) | Client-side “not found” | **TODO** | Poll alternatives **TODO** | **Section C2** |
| Promotion race | Poll `GET /api/v2/registrations/{id}` | State jumps to **`Accepted`** while user still on waitlist UI | **runtime** | Replace screen with **WF-WAIT-PROMOTED-01** + payment (**Section C2**) | Stale UI vs server |

### J5 — Admin / Leader Overrides

| Screen | API | Error / situation | Backend status code | User-facing behavior | Notes |
|--------|-----|-------------------|----------------------|------------------------|-------|
| Manual status | `PATCH /api/v2/registrations/{registrationId}/status` | Validation | **400** doc | Show invalid transition | |
| Manual status | `PATCH /api/v2/registrations/{registrationId}/status` | Not found | **404** doc | Registration missing | |
| Manual status | `PATCH /api/v2/registrations/{registrationId}/status` | Forbidden | **403** doc | Leader-only | |
| Manual payment fields | `PATCH /api/v2/registrations/{registrationId}/payment` | Same | **400** / **404** / **403** doc | Align with status patch | No separate **mark-paid** route (**Section J5**) |
| Refund | `POST /api/v2/admin/payments/{id}/refund` | Validation / auth / not found | **TODO** — refund op responses not fully enumerated in sample | Safe error + retry policy | Uses `Idempotency-Key` |
| Refund | `POST /api/v2/admin/payments/{id}/refund` | Forbidden | **TODO** | “Insufficient permission to refund” | Admin UX |
| Tour capacity edit | `PATCH /api/v2/tours/{tourId}` | Validation / auth / not found | **400** / **401** / **403** / **404** doc | Standard | **Section D2** capacity semantics **TODO** |

### J6 — Export / Reports

| Screen | API | Error / situation | Backend status code | User-facing behavior | Notes |
|--------|-----|-------------------|----------------------|------------------------|-------|
| CSV export | **TODO:** `/api/v2/reconciliation/export.csv` (**Section J6**) | Route missing | **TODO** / client **404** | Disable export or show “coming soon” | **Section A1** |
| Waitlist CSV | **TODO:** export-waitlist path | Same | **TODO** | Same | |

### J7 — Session (OpenAPI) & Cross-cutting

| Screen | API | Error / situation | Backend status code | User-facing behavior | Notes |
|--------|-----|-------------------|----------------------|------------------------|-------|
| Web login | `POST /api/v2/auth/web/session` | Invalid credentials | **401** doc | Inline error; no generic unknown | |
| Telegram session | `POST /api/v2/auth/telegram/session` | Invalid payload | **401** doc | Retry / restart Telegram flow | |
| Link Telegram | `POST /api/v2/auth/link-telegram` | Unauthorized | **401** doc | Login | |

---

## (3) UX Responses

### Copy (placeholders — finalize in UX)

| Category | Example user-facing headline | Example body |
|----------|------------------------------|--------------|
| Validation (400) | “Please fix the highlighted fields.” | Use `error.message` + field hints from `details` |
| Session (401) | “Your session expired.” | “Sign in again to continue.” (**G1**) |
| Permission (403) | “You don’t have access.” | “Contact the organizer if you need help.” |
| Not found (404) | “We couldn’t find this registration (or tour).” | “Check the link or go back to tours.” |
| Conflict / capacity (**TODO** code) | “This tour just filled up.” | “You can join the waitlist or try again.” (**C1**) |
| Idempotency (**TODO** code) | “This request already went through.” | “We’ll show the existing result.” (**E1**) |
| Payment pending (runtime) | “Confirming your payment…” | Subtext: can take a minute (**B2**) |
| Payment failed (runtime) | “Payment didn’t go through.” | “Your registration was not completed; the seat has been released.” (**B3**) |
| Network | “Connection problem.” | “Check your network and tap Retry.” (**G2**) |
| Admin override (runtime) | “This registration was updated.” | Neutral sync (**D4**) |

### Buttons and actions

| Situation | Primary action | Secondary |
|-----------|----------------|-----------|
| Validation | Fix fields + **Submit** | **Cancel** |
| Session expired | **Sign in** | **Back** |
| Not found | **Go to tours** / **Home** | — |
| Payment pending timeout | **Refresh status** | **Help** |
| Payment failed | **Try again** (if product allows new intent) / **Browse tours** | **Help** |
| Network | **Retry** | **Back** |

### Auto-retry

- **Polling** (`GET /api/v2/registrations/{id}`): exponential backoff while **`WF-PAY-ASYNC-01`** applies (**Section B2**) — **TODO:** max duration.
- **Network GET**: one automatic retry optional; then user-triggered (**G2**).
- **Mutations (POST/PATCH)**: **no** auto-retry by default—risk of duplicate unless idempotency safe (**E1**).

### Redirect patterns

- After gateway return: always land on **pending confirmation** route until **`Paid`** + **`AcceptedPaid`** or terminal failure (**B2**, **B4**).
- After **401** mid-flow: redirect to login with **return URL** (**TODO:** app-specific).

### Logging / monitoring

- Always log **`requestId`** from **`ErrorResponseDto`** when present—surface to support copy (“Reference: …”) **without modal** where possible.
- **TODO:** tie to observability vendor conventions.

---

## (4) Mapping to Runtime Lifecycle

Cross-references: **`frontend_readiness_tasks.md`** **B4**, **C3**, **D4**; authoritative transitions in **`docs/runtime-lifecycle.md`**.

### B4 — Payment lifecycle → FE

| Backend transition | FE must |
|--------------------|---------|
| `Payment`: `Pending` → `Paid`, `Registration`: `Accepted` → `AcceptedPaid` | Exit **WF-PAY-ASYNC-01** to success / confirmed UI |
| `Payment`: `Pending` → `Failed`, `Registration`: `Accepted` → `Rejected` | Show **WF-PAY-FAIL-01**; capacity released (**B3**) |
| `Payment`: `Paid` → `Refunded`, registration refund path | Refunded messaging (**F1**) |
| `Payment`: → `Cancelled` | **TODO** registration projection (**D3**, **H2**) |

Http errors on **`POST /api/v2/payments/intent`** are **TODO** in OpenAPI—FE should still map validation/auth once documented.

### C3 — Waitlist / capacity → FE

| Situation | FE must |
|-----------|---------|
| Capacity full at register | Waitlist branch or error—map **`error.code`** when known (**A2.1**, **C1**) |
| Another user takes last seat | Treat as contention / full—refresh **`GET /api/v2/tours/{tourId}`** |
| `WaitlistItem` → `Converted` | Move user to **seat available** + payment (**C2**, **WF-WAIT-PROMOTED-01**) |
| Payment failure frees seat | Another user may be promoted—your UI may become stale; refresh (**C1**) |

### D4 — Admin overrides → FE

| Remote change | FE must |
|---------------|---------|
| Admin marks paid while user sees pending | On next **`GET`**, show **confirmed**; optional **“Updated by organizer”** (**D4**) |
| Admin rejects while user sees accepted | Show **rejected**; clear optimistic UI |
| Leader PATCH conflicts with local assumptions | Same—**server wins** (**D4**) |

---

## (5) TODO List — Backend Error Payloads FE Still Needs

Items below are **gaps** between desired FE handling (**Sections B–G**, **J**) and what **`apps/api/openapi.json`** guarantees today.

1. **`POST /api/v2/payments/intent`**: document **400** / **401** / **403** / **409** (if any) with `ErrorResponseDto` examples—currently only **201** is listed.
2. **`POST /api/v2/tours/{tourId}/register`**: document capacity / concurrency responses (**CAPACITY_FULL**, **CONCURRENCY_CONFLICT**) with HTTP status and `error.code` values (**Section A2.1**, **C1**).
3. **Idempotency**: confirm **`IDEMPOTENCY_KEY_REPLAY_MISMATCH`** string and HTTP status for **`idempotency-key` / `Idempotency-Key`** mismatches (**E1**).
4. **Waitlist conversion**: specific codes when convert is invalid (wrong state, duplicate conversion)—**Section C2**.
5. **Payment gateway / webhook**: participant-visible **`reason`** field path when payment fails—**Section B3** (today **`PaymentWebhookDto.reason`** is webhook-side; participant snapshot **TODO**).
6. **Admin rejection**: reason/actor for **`Rejected`** to distinguish organizer vs payment failure (**D1**, **D4**).
7. **PATCH refund** and other admin mutators: full error matrix in OpenAPI.
8. **Export routes** (when added): **404** / **500** for CSV generation (**J6**).
9. **Global** **500** / **503**: not uniformly listed per operation—define standard **`ErrorResponseDto`** + retry guidance (**G2**).

---

## Revision history

| Date | Change |
|------|--------|
| — | Initial `frontend_error_states.md` (FE contract only). |
