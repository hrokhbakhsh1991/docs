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
- Independent web login/onboarding supported: **phone number + OTP** (`POST /api/v2/auth/web/session/otp`), tenant from **subdomain**; see **`docs/authentication-phone-otp.md`**.
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

- dynamic tour creation wizard with profile-aware UI
- tour CRUD and lifecycle
- registration lifecycle state transitions
- capacity constraint enforcement
- waitlist queue handling (FIFO)
- payment status recording and leader-facing visibility
- Telegram link access control by registration status

## 5.1 Dynamic Wizard Architecture (Pilot Ready)

- **Profile-Driven UI:** The wizard shell (`TourCreateWizard.tsx`) dynamically resolves a `TourFormProfile` based on the selected theme.
- **Rules Layer:** Field visibility and required-ness are controlled by `ProfileRules` (L1 pure domain), allowing per-tenant customization without code changes.
- **Tenant Templates:** `TenantWizardTemplate` (DB/API) supports overriding base profiles, skipping steps, and patching field rules via JSON overlays.
- **Ghost Data Protection:** Automated strip-on-save (client and server) ensures that data from hidden steps (e.g., itinerary for urban events) never leaks into the domain model.
- **Cross-Tenant Isolation:** Drafts and templates are strictly scoped to the active workspace subdomain.

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
- `Payments`: intent creation, status transitions, webhook ingestion, timeout processing, and refund
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
- MVP payment coupling model:
  - Internal webhook endpoint MAY ingest provider status updates.
  - Pending payments MAY be auto-failed by timeout policy.
  - Payment transitions MUST remain tenant-safe, transactional, and deterministic with registration side effects.

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
