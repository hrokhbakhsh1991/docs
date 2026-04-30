Document-ID: MKT-DOC-TECHNICAL-SPEC-V2
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Technical Specification v2

## 1. Technical Goal

Deliver a leader-centric, dual-mode operational platform with strict tenant isolation and low-complexity MVP delivery.

---

## 2. Architecture Model

- Shared multi-tenant application
- Tenant-scoped domain operations
- Single business core across two entry modes:
  - Telegram Mini App
  - Standalone web

## 2.1 Database and Infrastructure

- ORM implementation: TypeORM (Prisma was referenced in early architecture drafts)

---

## 3. Identity and Auth

## 3.1 Telegram Mode
- Telegram init payload must be validated server-side before trust.
- Session must carry tenant and user context.

## 3.2 Web Mode
- Independent web login/onboarding supported.
- `Connect Telegram` must link identities post-onboarding.

---

## 4. Access Control

- Leader roles can operate only inside authorized tenant boundaries.
- Participant views are tenant-resolved from entry context.
- Admin-level capabilities are operationally single-tenant in MVP tenant-facing surfaces.

## 4.1 Tenant Resolution and Fail-Closed Policy (Backend)

- Tenant trusted-signal precedence: Web > API > Backoffice > Telegram. In case of missing trusted signal, apply FAIL-CLOSED by default.
- If trusted tenant signals conflict, request MUST be rejected (fail-closed).
- If required trusted tenant signal is missing for an endpoint class, request MUST be rejected (fail-closed).
- Canonical phrase for MVP admin cross-tenant: 'No cross-tenant admin read/write/export on MVP operational surfaces'. Apply this phrase verbatim in all backend docs.

---

## 5. Functional Technical Scope (MVP)

- tour CRUD and lifecycle
- registration lifecycle state transitions
- capacity constraint enforcement
- waitlist queue handling (FIFO)
- payment status recording and leader-facing visibility
- Telegram link access control by registration status

---

## 6. Non-Functional Constraints

- mobile-first performance for Telegram/web journeys
- strict tenant isolation at API and data layers
- deterministic status transitions
- operationally simple deployment for rapid MVP iteration

---

## 7. API Surface (Logical)

- `Auth`: Telegram mode auth validation + web auth + account linking endpoint
- `Tours`: create/read/update/lifecycle transitions
- `Registrations`: submit/review/accept/reject/cancel/no-show
- `Waitlist`: enqueue/dequeue/convert
- `Payments`: status update and paid amount recording
- `Dashboard`: aggregated operational visibility

## 7.1 API Semantics Baseline

- Idempotency/retry policy must be defined for create/update/convert operations before release freeze.
- Error classes must distinguish at least: validation, conflict, authorization/tenant-boundary, transient.
- Unknown-field policy: STRICT REJECT across all channels and API versions. Incoming payloads with unknown top-level fields must be rejected; record the rejection in intake logs.

---

## 8. Implementation Notes

- Capacity should be protected against race conditions during acceptance transitions.
- Status updates should be auditable.
- Reconciliation views should support export-ready output structures.
- No gateway coupling is required in MVP.

Related canonical docs:
- `docs/20-architecture/data_model.md`
- `docs/20-architecture/contracts/participant_intake_schema.md`
- `docs/20-architecture/contracts/audit_event_schema.md`
- `docs/20-architecture/contracts/reconciliation_export_contract.md`
- `docs/40-clarifications/clarifications_backlog.md`

---

## Changelog

- 2026-04-28: Added backend tenant precedence and fail-closed access policy baseline.
- 2026-04-28: Clarified MVP admin scope as single-tenant on operational surfaces.
- 2026-04-28: Added API semantics baseline and canonical backend cross-reference list.
- 2026-04-28: Applied resolved tenant precedence, canonical admin phrase, and strict unknown-field policy text. — Decision Source: CLAR-TNT-001/CLAR-TNT-003/CLAR-034 — 2026-04-28
