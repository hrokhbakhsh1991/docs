Document-ID: MKT-DOC-DATA-MODEL-V2
Version: v1.2
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-05-04
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Data Model v2 (Leader-Centric)

## 1. Purpose

This document defines the canonical data model for the leader-centric, dual-mode product.
It preserves validated operational behavior and adds explicit tenant boundaries.

---

## 2. Core Entities

- `Tenant` (Leader workspace boundary)
- `User`
- `Tour`
- `TourLeader` — **Planned entity – not implemented yet** (see §4.3); leader capabilities today are expressed via `User` membership in a tenant (`user_tenants.role`), not per-tour roles.
- `Registration` — **canonical participant profile surface for MVP** (participant attributes and lifecycle live on this aggregate; see §4.4).
- `ParticipantProfile` — **Future extension – current MVP uses Registration** (see §4.5).
- `WaitlistItem`
- `Payment`

---

## 3. Tenant Boundary

All business entities must resolve a tenant context.
Minimal rule: records are either directly tenant-owned or tenant-resolvable through parent entities.

Tenant resolution and enforcement for backend operations follow:
- `docs/20-architecture/technical_spec.md` (request-level access rules)
- `docs/40-clarifications/tenant_boundary_policy.md` (channel precedence details, pending final freeze)

### 3.1 Tenant Isolation Model

Isolation for tenant-scoped data is enforced by combining three mechanisms:

1. **JWT `tenant_id` claim** — After verification, the API treats the token’s `tenant_id` (with `sub` / `role`) as the active workspace for the request. Evidence: `apps/api/src/common/middleware/auth.middleware.ts`.
2. **PostgreSQL RLS** — Tables with a `tenant_id` column use **`FORCE ROW LEVEL SECURITY`** and policy **`tenant_isolation_policy`** (`USING` / `WITH CHECK`: row `tenant_id` = `current_setting('app.tenant_id')::uuid`). Evidence: `apps/api/src/database/migrations/1777558732331-BaselineSchema.ts`.
3. **Request context** — `RequestContextService` holds the trusted tenant (and user/role) for the lifetime of the request; the DB layer binds **`set_config('app.tenant_id', …)`** on each `QueryRunner` connect so RLS matches that context. Evidence: `apps/api/src/common/request-context/request-context.service.ts`, `apps/api/src/database/tenant-session-binding.service.ts`.

**Registration / waitlist HTTP payloads:** Do **not** include a client-supplied `tenant_id` / `tenantId` for mutation contracts in the implemented API; effective tenant for writes comes from **JWT + resolved tour row** (authenticated paths) or **server-side tour resolution** (public register/waitlist). Canonical ownership narrative: `docs/security/api_ownership_audit.md`.

### 3.2 Core persistence relationships

The implemented relational shape for **users, membership, tenant, and tours** is:

```text
User
  ↕  (1:N via `user_tenants`)
user_tenants  — role + membership for one (`user_id`, `tenant_id`) pair
  ↕
Tenant
  ↕  (1:N: each tour row carries `tenant_id`)
Tour  (table `tours`)
```

- **`user_tenants`** is the join between **`users`** and **`tenants`** (unique per user+tenant); role strings live here (`owner`, `admin`, `member`, `viewer` in the implemented API). **Workspace RBAC** (ordering, PATCH vs invite rules, `session_version` on role change) is centralized in `apps/api/src/common/rbac/workspace-membership-rbac.policy.ts` and applied from `UsersService` / `WorkspaceInvitesService`. Invite-based role assignment to `owner` is forbidden; ownership changes are handled only through the dedicated ownership-transfer flow. DB-level enforcement now includes: (1) partial unique index for at most one active owner row per workspace; (2) deferred constraint trigger preventing zero-owner workspace states at transaction commit.
- **Tour-ops web directory:** Eligible workspace roles use **`/users`** (list + client-side filtering/sorting/paging over **`GET /api/v2/users`**) and **`/users/:id`** (detail resolved from that roster—no extra user-by-id read API). Product screen id: `S-LEAD-07` in `docs/10-product/screens_overview.md`.
- **Leader clarification:** when accessing non-owned workspaces without direct membership, Leader is downgraded to `USER` role with read-only access.
- **`tours`** rows are **tenant-scoped** via column `tenant_id`; registrations and waitlist items hang off `tour_id` and duplicate `tenant_id` for RLS and query convenience.

---

## 4. Entity Summaries

## 4.1 User
- global identity profile
- role capabilities resolved in context (tour/tenant), not globally fixed
- **Web login:** `POST /api/v2/auth/web/session/otp` resolves the user by **`users.phone`** using SQL **`phone_normalized()`** (function; no `phone_normalized` column). Column **`is_phone_verified`** exists; product policy may tighten over time. **`hashed_password`** is required in the schema for non-web paths (e.g. Telegram) but **not** used for web OTP. See **`docs/authentication-phone-otp.md`**.

## 4.2 Tour

- Tenant-scoped; all reads/writes resolve through the tenant context (see §3).
- **Authoritative field list (MVP):** the HTTP API contract — **`docs/20-architecture/contracts/api_endpoint_contracts_v2_base.md`** (GET `/api/v2/tours` / GET `/api/v2/tours/{tourId}` projection) — and the generated **`apps/api/openapi.json`** schema `TourResponseDto`. The running API is the source of truth for shape and nullability.

**Operational fields in MVP (API JSON uses camelCase; DB columns are snake_case where noted):**

| Concept | API / persistence notes |
|---------|-------------------------|
| Identity & audit | `id`; `createdAt` / `updatedAt` (timestamps on the tour row) |
| Copy | `title` (required); `description` (optional) |
| Capacity (source of truth at tour level) | `totalCapacity` ↔ `total_capacity`; `acceptedCount` ↔ `accepted_count` |
| Lifecycle | `lifecycleStatus` ↔ `lifecycle_status` — enum values **`DRAFT`**, **`OPEN`**, **`CLOSED`**, **`CANCELLED`** on the wire (see contract + OpenAPI). Product language may use *Draft / Open / Closed / Cancelled*. |
| Communication | `chatLink` ↔ `chat_link` (optional leader-managed link, e.g. Telegram) |
| Pricing / opaque ops JSON | `costContext` ↔ `cost_context` (optional JSONB; e.g. currency, `totalCost`, optional `location` projection used by the web UI until first-class fields exist) |

**Out of MVP (Tour):** persisted **tour schedule dates** (`startDate` / `endDate`) are **not** part of the MVP model or contract projection. Do not document or assume stored start/end instants for tours until added to the contract and backend schema.

**Related:** `docs/20-frontend-domain-model-alignment.md` (how `@repo/types` maps to OpenAPI).

## 4.3 TourLeader

> **Planned entity – not implemented yet.** There is no `TourLeader` table or OpenAPI resource in the current codebase; leader access is modeled at **tenant** scope via membership roles (see §2 and §3.2).

- *(Planned concept)* maps users to leader permissions per tour
- *(Planned concept)* role options: `Owner`, `CoLeader`

## 4.4 Registration

**MVP:** `Registration` is the **canonical participant profile** — participant-facing attributes (name, phone, transport, notes, optional Telegram fields, etc.) and lifecycle status are stored on the registration aggregate for the tour; there is no separate persisted `ParticipantProfile` entity in MVP.

- maps user participation per tour
- **Participant journey states (product-oriented labels):**
  - **`Pending`** — registration row exists; not yet accepted/rejected.
  - **`Waitlisted`** — participant is in the **wait queue** for the tour; in persistence this is a **`WaitlistItem`** with status `Waiting` (there is **no** `Registration.status = "Waitlisted"` value in the API enum).
  - **`Accepted`** — accepted; may still await payment depending on tour rules.
  - **`AcceptedPaid`** — accepted with payment satisfied per product rules.
  - **`Cancelled`** — registration cancelled.
- **Authoritative `Registration.status` enum (API / DB / `openapi.json` `RegistrationResponseDto`):** `Pending`, `Accepted`, `AcceptedPaid`, `Rejected`, `Cancelled`, `NoShow`, `Refunded` — use this list for contract and validation; the journey list above maps product language to rows (waitlist vs registration).
- payment tracking fields:
  - `payment_status`: `NotPaid`, `Partial`, `Paid`, `Failed`, `Refunded`
  - `paid_amount` (optional)
  - `paymentMetadata?: Json` (optional, internal transaction metadata container for gateway transaction IDs, refund references, failure reasons)

**Payload note:** Implemented **`POST /api/v2/registrations`**, **`POST /api/v2/bookings`**, **`POST /api/v2/tours/{tourId}/register`**, **`POST /api/v2/tours/{tourId}/waitlist`**, and **`POST /api/v2/waitlist-items`** contracts **do not** accept a top-level **`tenant_id` / `tenantId`** from the client for tenant scope; isolation follows **§3.1 Tenant Isolation Model** and `docs/security/api_ownership_audit.md`.

## 4.5 ParticipantProfile

> **Future extension – current MVP uses Registration.** MVP participant attributes live on **`Registration`** (§4.4); no separate `ParticipantProfile` table or DTO exists today.

- *(Planned concept)* tour-context participant attributes
- *(Planned concept)* driver metadata stored here (not a standalone entity role) — **deferred:** comparable optional fields on `Registration` / ops metadata until this entity ships

## 4.6 WaitlistItem
- separate queue entity
- canonical status:
  - `Waiting`
  - `Converted`
  - `Cancelled`
- FIFO ordering based on creation sequence

## 4.7 Payment
- operational transaction record for payment lifecycle and provider reconciliation
- fields: `id`, `registration_id`, `amount`, `currency`, `provider`, `provider_payment_id`, `status`, `paid_at`, `failed_at`, `refunded_at`, `created_at`, `updated_at`
- canonical status lifecycle:
  - `Pending -> Paid`
  - `Pending -> Failed`
  - `Paid -> Refunded`
  - `Paid -> Cancelled`

---

## 5. Source-of-Truth Rules

- Capacity truth:
  - `Registration.status` in **`Accepted`** or **`AcceptedPaid`** consumes capacity (aligned with payment-backed acceptance flows in §5.2)
- Full condition:
  - `accepted_count >= total_capacity`
- Payment truth in MVP:
  - Payment record is authoritative source-of-truth for read/export operations.
  - Registration payment fields are preliminary operational fields.
  - On mismatch, follow policy: 'Retry (up to 3x) then Reject and create reconciliations task'.

## 5.1 Payment Status Algebra (Backend Validation Baseline)

- `NotPaid`: `paid_amount` is absent or equals `0`.
- `Partial`: `paid_amount > 0` and less than the tour payable amount.
- `Paid`: `paid_amount` equals the tour payable amount.
- `paid_amount` MUST NOT be negative.
- Currency precision and rounding policy is delegated to business rules and must be applied consistently in API validation and export generation.

## 5.2 Payment Lifecycle (Registration)

Allowed transitions:

- `NotPaid` -> `Paid`
- `NotPaid` -> `Failed`
- `Failed` -> `NotPaid` (retry)
- `Paid` -> `Refunded`
- `Accepted` -> `AcceptedPaid` when payment succeeds
- `Accepted`/`AcceptedPaid` -> `Rejected` when payment fails or times out (capacity released + waitlist promotion)
- `AcceptedPaid` -> `Refunded` when admin refund is applied

Guard rule:

- `Cancelled` registrations cannot transition payment status.

---

## 6. Integrity Constraints

- No duplicate active registration (`Pending` / `Accepted` / `AcceptedPaid`) for same `(user, tour)` (exact “active” set follows API validation rules).
- No simultaneous active registration and active waitlist record for same `(user, tour)`.
- `total_capacity` cannot be reduced below current `accepted_count`.
- Tenant boundary must be enforced in all read/write paths.

## 6.1 Tenant-Scoped Query Classes

Tenant predicate enforcement is mandatory for:
- by-id reads (`tour_id`, `registration_id`, `waitlist_item_id`)
- list/search queries
- aggregate/dashboard queries
- reconciliation export queries

No exception endpoints are allowed in MVP unless explicitly approved and documented.

---

## 7. Dual-Mode Identity Notes

- Telegram mode users authenticate with Telegram identity context.
- Web mode users may start without Telegram and link later.
- Account linking must unify identity records without duplicating operational data.

---

## Changelog

- 2026-05-04 (v1.2): Renamed §3.1 to **Tenant Isolation Model** (JWT claim + RLS + request context); added §3.2 **Core persistence relationships** (`User` ↔ `user_tenants` ↔ `Tenant` ↔ `Tour`); updated `TourLeader` / `ParticipantProfile` labels per product wording; expanded registration status narrative (journey labels + authoritative enum); payload note references §3.1 title.
- 2026-05-04 (v1.1): Annotated `TourLeader` and `ParticipantProfile` as planned/not implemented; stated `Registration` as canonical participant profile for MVP; added `AcceptedPaid` to registration statuses; aligned capacity rule with `Accepted`/`AcceptedPaid`; added §3.1 JWT + RLS evidence and explicit removal of client `tenant_id` on registration-related payloads; clarified core entity list in §2.
- 2026-05-04: Expanded Tour (§4.2) with MVP operational fields, API/contract as source of truth, and explicit exclusion of persisted tour schedule dates.
- 2026-04-29: Synced Registration payment lifecycle documentation with implemented internal lifecycle states and metadata container (`paymentMetadata`).
- 2026-04-28: Added backend payment-status algebra baseline and explicit tenant query-class enforcement.
- 2026-04-28: Added cross-reference to technical and tenant-boundary clarification policy for tenant resolution consistency.
- 2026-04-28: Updated payment source-of-truth to authoritative Payment record with mismatch policy. — Decision Source: CLAR-017 — 2026-04-28
