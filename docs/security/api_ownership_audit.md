# API ownership & IDOR audit (multi-tenant)

**Scope:** `apps/api` HTTP surface + services that load entities by `registrationId`, `bookingId` (same as registration), `paymentId`, `tourId`, `waitlistItemId`, `userId`.

## Tenant source of truth policy

| Caller | Where `tenant_id` comes from | Client `tenantId` in body/query |
| ------ | ------------------------------ | --------------------------------- |
| **Authenticated** (`AuthorizationPresenceGuard` + auth middleware JWT) | `RequestContextService` filled by **`AuthMiddleware`** from the Bearer token/JWT cookie (not by the guard). The guard only **requires an `Authorization` header** so unauthenticated callers get **401** before handlers run. | **Ignored / rejected** — removed from `CreateRegistrationDto` and `CreateWaitlistItemDto`. Canonical tenant for writes is **`tour.tenantId`** resolved in the service, then **must equal** JWT tenant for non-`admin` roles (else **404**). |
| **Public** (`POST .../tours/:tourId/register`, `.../waitlist`) | No JWT — derived only from **database**: `getTenantIdForTourOrThrow(tourId)` then locked `requireTourInTenantForUpdate`. Body must **not** carry `tenantId` (idempotency scope uses resolved tenant). |
| **Internal** (webhook, ops) | Service / provider payload | N/A for end-user spoofing |

**Rules (summary)**

- Authenticated routes → effective tenant for mutations is **JWT + tour row**; clients cannot override tenant via DTO.
- **Admin** may create resources for tours in another tenant than the JWT claim (explicit escape hatch).
- Public routes → tenant is **never** trusted from the client; only **tour id → existing row → `tour.tenant_id`**.

---

**Policies enforced**

| Role   | Tenant context (JWT / request) | Registration / booking / linked payment |
| ------ | -------------------------------- | -------------------------------------- |
| member | Required                         | Only rows tied to actor (`syntheticBookingContactPhone` and/or optional `telegramUserId` + `tenantId`). |
| leader (`owner`) | Required                  | Any row in tenant. |
| admin  | Optional for global reads        | Any row globally (cross-tenant by id where applicable). |

**Denylist / enumeration**

- Prefer **404 `RESOURCE_NOT_FOUND`** when the scoped query misses (including wrong owner), not distinct “wrong tenant” vs “wrong owner” messages.

---

## Central helper

| Artifact | Purpose |
| -------- | ------- |
| `apps/api/src/common/security/ownership-scope.ts` | `registrationWhereForActor`, `waitlistWhereForActor`, `findPaymentScopedForActor`, `syntheticBookingContactPhone`, plus `requireActorScope` semantics (authenticated role + tenant rules). |

Payments and registrations reuse these builders for **query-level** filtering.

---

## Endpoint matrix

| Module | Endpoint | Former risk | Risk now | Fixed? | Check type |
| ------ | -------- | ----------- | -------- | ------ | ---------- |
| Registrations | `POST /api/v2/tours/:tourId/register` | Public; body `tenantId`. | **Fixed:** no `tenantId` in schema; `getTenantIdForTourOrThrow` → context + idempotency tenant; service locks tour by DB tenant. | Yes | tour DB lookup + rate limit |
| Registrations | `POST /api/v2/tours/:tourId/waitlist` | Same. | Same as register. | Yes | tour DB lookup |
| Registrations | `POST /api/v2/registrations` | Body `tenantId`. | **Fixed:** DTO has no `tenantId`; `createRegistration` uses `tour.tenantId` and `assertJwtTenantMatchesTourForAuthenticatedMutation` (admin exempt). | Yes | JWT + tour row |
| Registrations | `POST /api/v2/bookings` | `tourId` only | `createBooking` uses context `tenantId` + user-derived phone / telegram. | Yes | tenant + synthetic identity |
| Registrations | `GET /api/v2/bookings` | Member leakage if unscoped list. | Scoped to member identity in tenant. Leader path if added must list tenant-wide. | Yes | tenant + owner (member) |
| Registrations | `GET /api/v2/registrations/:registrationId` | IDOR if id-only lookup. | `registrationWhereForActor` + `findOne`. | Yes | tenant + owner / role |
| Registrations | `PATCH /api/v2/registrations/:registrationId/status` | IDOR | Leader-only controller; load via scoped query in service. | Yes | tenant + role (leader) |
| Registrations | `PATCH /api/v2/registrations/:registrationId/payment` | IDOR | Same pattern. | Yes | tenant + role (leader) |
| Registrations | `POST /api/v2/waitlist-items` | Spoofed tenant in DTO | **Fixed:** no `tenantId` in DTO; `createWaitlistItem` resolves tenant from tour + JWT match (admin exempt). | Yes | JWT + tour row |
| Registrations | `POST /api/v2/waitlist-items/:waitlistItemId/convert` | IDOR on waitlist id | `requireWaitlistItemForUpdate` + `waitlistWhereForActor` (pessimistic lock). | Yes | tenant + role (leader) |
| Registrations | `PATCH /api/v2/waitlist-items/:waitlistItemId/cancel` | IDOR | Scoped waitlist query; member must match synthetic phone. | Yes | tenant + owner / role |
| Tours | `GET /api/v2/tours` | List without tenant | Filtered by context `tenantId`. | Yes | tenant |
| Tours | `GET /api/v2/tours/:tourId` | Cross-tenant tour id | Lookup `id` + context `tenantId`. | Yes | tenant |
| Tours | `PATCH /api/v2/tours/:tourId` | Cross-tenant update | Lookup `id` + context `tenantId`. | Yes | tenant |
| Tours | `GET /api/v2/tours/:tourId/registrations` | Leader id-only tour | Transaction + `requireTourInTenant`. | Yes | tenant |
| Tours | `GET /api/v2/tours/:tourId/waitlist-items` | Same | Same. | Yes | tenant |
| Payments | `POST /api/v2/payments/intent` | Registration IDOR | `registrationWhereForActor` inside txn; mismatch returns **404**; admin may omit JWT tenant when acting globally; non-admin JWT tenant mismatch → **404**. | Yes | tenant + owner / admin |
| Payments | `GET /api/v2/admin/payments` | Admin global list | **By design:** global payment listing for admin role only. | N/A | role (admin) |
| Payments | `GET /api/v2/admin/payments/:id` | Service id-only if bypassed | `findPaymentScopedForActor` (admin: id-only; others: tenant + member registration link). | Yes | role + tenant + owner |
| Payments | `POST /api/v2/admin/payments/:id/refund` | Same | Uses `findPaymentScopedForActor` before transition. | Yes | role + tenant + owner |
| Payments | `internal/payments/webhook` | Trust provider payload | Internal key; resolves payment with operational tenant probe (not end-user JWT). | N/A | internal + provider |
| Users | `GET /api/v2/users` | Cross-tenant user list | Membership join scoped to context `tenantId`. | Yes | tenant |
| Users | `PATCH /api/v2/users/:id` | Cross-tenant role edit / privilege escalation | Target `user_tenants` row scoped by JWT `tenantId` + path `userId`; centralized RBAC policy forbids self-change, `owner` assignment, mutating `owner` rows, and non-hierarchical changes; success bumps `session_version` (JWT `sess_ver` invalidation). | Yes | tenant + membership + RBAC |
| Auth | `POST /api/v2/auth/*` | N/A | No resource id traversal. | N/A | web: phone + OTP; telegram: signed init payload |
| Ops | `internal/ops/*` | N/A | Internal API key; aggregates only. | N/A | internal key |

**Web (`apps/web`) — Users directory (reference, same tenant rules):** Routes **`/users`** and **`/users/:id`** consume the APIs above; list UI applies **client-side** search/filter/sort/pagination over the fetched roster. **No in-app “invite member”** completion path is documented here—the screen does not add new ownership surfaces beyond these endpoints.

---

## Service methods (non-HTTP) worth noting

| Method | Note |
| ------ | ---- |
| `RegistrationsService.updatePaymentStatus` | Now uses `registrationWhereForActor` (was id + loose tenant check). |
| `PaymentsService.getLatestPaymentForRegistration` | Uses `requireRegistrationOwnedByActor` before listing payments. |
| `PaymentsService.listPayments` | Admin-only at controller; filters `deletedAt IS NULL`. |

---

## Tests

| File | Coverage |
| ---- | -------- |
| `apps/api/test/security/ownership-access.unit-spec.ts` | Member vs other registration; leader; admin cross-tenant; payment intent denial. |
| `apps/api/test/security/tenant-jwt-scope.unit-spec.ts` | JWT tenant ≠ `tour.tenantId` → **404** on authenticated create; `getTenantIdForTourOrThrow` behaviour. |
| `apps/api/test/registrations/*.unit-spec.ts` | Harnesses updated with `getRole()` + composite `findOne` where clauses. |

**Anonymous / 401:** User JWT routes use `AuthorizationPresenceGuard` (presence of `Authorization`); JWT validation is in **`AuthMiddleware`**. No ownership test in service layer for unauthenticated callers.

---

## Residual risks (MVP)

1. **Public** flows remain unauthenticated — only **rate limits** and **valid `tourId`** reduce abuse; tenant is server-derived from tour.
2. **Auth session (web/Telegram)** tenant scope comes **only** from the inbound HTTP host (`TenantResolverMiddleware`); clients cannot assert a tenant UUID in the login body — separate from registration DTOs.
3. **Webhook** tenant probe loops all tenants on miss — acceptable for internal pipeline; monitor for abuse of internal keys.

---

*Last updated: tenant source-of-truth (JWT + tour row) for authenticated flows; public tenant from tour-only lookup.*
