Document-ID: MKT-DOC-DATA-MODEL-V2
Version: v1.0
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

- `Tenant` (leader workspace boundary)
- `User`
- `Tour`
- `TourLeader`
- `Registration`
- `ParticipantProfile`
- `WaitlistItem`
- `Payment`

---

## 3. Tenant Boundary

All business entities must resolve a tenant context.
Minimal rule: records are either directly tenant-owned or tenant-resolvable through parent entities.

Tenant resolution and enforcement for backend operations follow:
- `docs/20-architecture/technical_spec.md` (request-level access rules)
- `docs/40-clarifications/tenant_boundary_policy.md` (channel precedence details, pending final freeze)

---

## 4. Entity Summaries

## 4.1 User
- global identity profile
- role capabilities resolved in context (tour/tenant), not globally fixed

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
- maps users to leader permissions per tour
- role options: `Owner`, `CoLeader`

## 4.4 Registration
- maps user participation per tour
- canonical status:
  - `Pending`
  - `Accepted`
  - `Rejected`
  - `Cancelled`
  - `NoShow`
- payment tracking fields:
  - `payment_status`: `NotPaid`, `Partial`, `Paid`, `Failed`, `Refunded`
  - `paid_amount` (optional)
  - `paymentMetadata?: Json` (optional, internal transaction metadata container for gateway transaction IDs, refund references, failure reasons)

## 4.5 ParticipantProfile
- tour-context participant attributes
- driver metadata stored here (not a standalone entity role)

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
  - only `Registration.status = Accepted` consumes capacity
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

- No duplicate active registration (`Pending`/`Accepted`) for same `(user, tour)`.
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

- 2026-05-04: Expanded Tour (§4.2) with MVP operational fields, API/contract as source of truth, and explicit exclusion of persisted tour schedule dates.
- 2026-04-29: Synced Registration payment lifecycle documentation with implemented internal lifecycle states and metadata container (`paymentMetadata`).
- 2026-04-28: Added backend payment-status algebra baseline and explicit tenant query-class enforcement.
- 2026-04-28: Added cross-reference to technical and tenant-boundary clarification policy for tenant resolution consistency.
- 2026-04-28: Updated payment source-of-truth to authoritative Payment record with mismatch policy. — Decision Source: CLAR-017 — 2026-04-28
