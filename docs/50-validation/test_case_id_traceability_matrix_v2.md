# Test Case ID Traceability Matrix v2

Document-ID: MKT-DOC-TRACEABILITY-TESTS-V2
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-28
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

## A) Test ID Policy

Stable canonical format:
- `TC-SR-FR-XXX-YY` for functional requirements.
- `TC-SR-NFR-XXX-YY` for non-functional requirements.

Policy rules:
1. `XXX` equals SR numeric identifier; `YY` is stable sequence per SR.
2. Each test row MUST include: requirement, endpoint/flow touchpoint, test type, expected oracle.
3. IDs are immutable once published; new cases append next `YY`.

## B) Requirement-to-Test Matrix

| Test Case ID | Requirement | Endpoint/Flow Touchpoint | Test Type | Expected Oracle |
|---|---|---|---|---|
| `TC-SR-FR-001-01` | `SR-FR-001` | `POST /api/v2/registrations` | integration | second active registration returns `REGISTRATION_DUPLICATE_ACTIVE` and no new record |
| `TC-SR-FR-001-02` | `SR-FR-001` | `PATCH /api/v2/registrations/{registrationId}/status` | integration | concurrent accept: one success, loser `CONCURRENCY_CONFLICT` |
| `TC-SR-FR-002-01` | `SR-FR-002` | `POST /api/v2/registrations` | unit | missing required field rejected with canonical validation code |
| `TC-SR-FR-002-02` | `SR-FR-002` | `participant_intake_schema` + registration flow | contract | telegram conditional field rule enforced (`telegram_user_id`) |
| `TC-SR-FR-003-01` | `SR-FR-003` | `GET /api/v2/dashboard/leader-workspace` | integration | leader sees tenant-scoped aggregate only |
| `TC-SR-FR-003-02` | `SR-FR-003` | `GET /api/v2/registrations/{registrationId}` | e2e | leader workspace and detail are state-synchronized |
| `TC-SR-FR-004-01` | `SR-FR-004` | `PATCH /api/v2/registrations/{registrationId}/payment` | unit | non-canonical payment enum rejected |
| `TC-SR-FR-004-02` | `SR-FR-004` | payment flow + endpoint patch | integration | valid transition persists status and amount consistently |
| `TC-SR-FR-005-01` | `SR-FR-005` | `POST /api/v2/waitlist-items/{waitlistItemId}/convert` | integration | conversion selects earliest eligible `Waiting` item |
| `TC-SR-FR-005-02` | `SR-FR-005` | waitlist flow + cancel endpoint | integration | converted item cannot transition to `Cancelled` (`STATE_TRANSITION_INVALID`) |
| `TC-SR-FR-006-01` | `SR-FR-006` | registration status update + participant read | integration | non-accepted cannot access communication link |
| `TC-SR-FR-006-02` | `SR-FR-006` | telegram integration flow | e2e | accepted participant can access communication link |
| `TC-SR-FR-007-01` | `SR-FR-007` | `GET /api/v2/reconciliation/export.csv` | contract | required CSV columns exist in stable order |
| `TC-SR-FR-007-02` | `SR-FR-007` | reconciliation export flow | integration | export returns only requested tenant/tour rows |
| `TC-SR-FR-008-01` | `SR-FR-008` | `POST /api/v2/auth/telegram/session` | integration | telegram session created with valid context |
| `TC-SR-FR-008-02` | `SR-FR-008` | `POST /api/v2/auth/web/session` | e2e | web mode follows same business-core behavior |
| `TC-SR-FR-009-01` | `SR-FR-009` | telegram auth + registration create | integration | telegram-required path without context returns `AUTH_TELEGRAM_CONTEXT_REQUIRED` |
| `TC-SR-FR-010-01` | `SR-FR-010` | `POST /api/v2/auth/link-telegram` | e2e | post-onboarding connect path succeeds and links account |
| `TC-SR-FR-010-02` | `SR-FR-010` | link endpoint idempotency | contract | replay with different payload returns `IDEMPOTENCY_KEY_REPLAY_MISMATCH` |
| `TC-SR-NFR-001-01` | `SR-NFR-001` | all protected endpoints | integration | missing trusted tenant context fails closed (`TENANT_CONTEXT_MISSING`) |
| `TC-SR-NFR-001-02` | `SR-NFR-001` | by-id reads/writes | security | cross-tenant access denied (`TENANT_SCOPE_FORBIDDEN`/scoped not found) |
| `TC-SR-NFR-002-01` | `SR-NFR-002` | status-changing endpoints | contract | critical transitions emit required audit events with actor+timestamp |
| `TC-SR-NFR-002-02` | `SR-NFR-002` | non-happy path transitions | integration | rejected transitions emit no false positive state-change events |
| `TC-SR-NFR-003-01` | `SR-NFR-003` | leader dashboard journey | e2e | leader completes core decision path without external sheet dependency |
| `TC-SR-NFR-004-01` | `SR-NFR-004` | export endpoint | contract | CSV schema/order stable across runs |
| `TC-SR-NFR-004-02` | `SR-NFR-004` | export with concurrent updates | integration | snapshot consistency preserved or `EXPORT_SNAPSHOT_INCONSISTENT` |

## C) Endpoint-to-Test Matrix

| Endpoint | Requirements | Test Case IDs |
|---|---|---|
| `POST /api/v2/auth/telegram/session` | `SR-FR-008`, `SR-FR-009`, `SR-NFR-001` | `TC-SR-FR-008-01`, `TC-SR-FR-009-01`, `TC-SR-NFR-001-01` |
| `POST /api/v2/auth/web/session` | `SR-FR-008`, `SR-NFR-001` | `TC-SR-FR-008-02`, `TC-SR-NFR-001-01` |
| `POST /api/v2/auth/link-telegram` | `SR-FR-010`, `SR-NFR-001` | `TC-SR-FR-010-01`, `TC-SR-FR-010-02`, `TC-SR-NFR-001-01` |
| `POST /api/v2/tours` | `SR-FR-003`, `SR-NFR-001` | `TC-SR-FR-003-01`, `TC-SR-NFR-001-01` |
| `PATCH /api/v2/tours/{tour_id}` | `SR-FR-003`, `SR-NFR-001` | `TC-SR-FR-003-01`, `TC-SR-NFR-001-02` |
| `POST /api/v2/registrations` | `SR-FR-001`, `SR-FR-002`, `SR-FR-008`, `SR-FR-009`, `SR-NFR-001`, `SR-NFR-002` | `TC-SR-FR-001-01`, `TC-SR-FR-002-01`, `TC-SR-FR-002-02`, `TC-SR-FR-009-01`, `TC-SR-NFR-001-01`, `TC-SR-NFR-002-01` |
| `GET /api/v2/registrations/{registrationId}` | `SR-FR-003`, `SR-FR-006`, `SR-NFR-001` | `TC-SR-FR-003-02`, `TC-SR-FR-006-01`, `TC-SR-NFR-001-02` |
| `PATCH /api/v2/registrations/{registrationId}/status` | `SR-FR-001`, `SR-FR-006`, `SR-NFR-001`, `SR-NFR-002` | `TC-SR-FR-001-02`, `TC-SR-FR-006-01`, `TC-SR-FR-006-02`, `TC-SR-NFR-001-02`, `TC-SR-NFR-002-01`, `TC-SR-NFR-002-02` |
| `POST /api/v2/waitlist-items` | `SR-FR-005`, `SR-NFR-001`, `SR-NFR-002` | `TC-SR-FR-005-01`, `TC-SR-NFR-001-01`, `TC-SR-NFR-002-01` |
| `POST /api/v2/waitlist-items/{waitlistItemId}/convert` | `SR-FR-005`, `SR-FR-001`, `SR-NFR-001`, `SR-NFR-002` | `TC-SR-FR-005-01`, `TC-SR-FR-005-02`, `TC-SR-FR-001-02`, `TC-SR-NFR-001-02`, `TC-SR-NFR-002-01` |
| `PATCH /api/v2/waitlist-items/{waitlistItemId}/cancel` | `SR-FR-005`, `SR-NFR-001`, `SR-NFR-002` | `TC-SR-FR-005-02`, `TC-SR-NFR-001-02`, `TC-SR-NFR-002-02` |
| `PATCH /api/v2/registrations/{registrationId}/payment` | `SR-FR-004`, `SR-NFR-001`, `SR-NFR-002` | `TC-SR-FR-004-01`, `TC-SR-FR-004-02`, `TC-SR-NFR-001-02`, `TC-SR-NFR-002-01` |
| `GET /api/v2/dashboard/leader-workspace` | `SR-FR-003`, `SR-NFR-001`, `SR-NFR-003` | `TC-SR-FR-003-01`, `TC-SR-FR-003-02`, `TC-SR-NFR-001-01`, `TC-SR-NFR-003-01` |
| `GET /api/v2/reconciliation/export.csv` | `SR-FR-007`, `SR-NFR-001`, `SR-NFR-004` | `TC-SR-FR-007-01`, `TC-SR-FR-007-02`, `TC-SR-NFR-001-02`, `TC-SR-NFR-004-01`, `TC-SR-NFR-004-02` |

## D) Gate-Critical Regression Pack (Pre-Dev Minimum)

Minimum set required for Pre-Sprint-0 and release gates:

| Gate | Minimum Test IDs |
|---|---|
| Tenant & policy gate | `TC-SR-NFR-001-01`, `TC-SR-NFR-001-02`, `TC-SR-FR-009-01`, `TC-SR-FR-010-02` |
| Functional P0 gate | `TC-SR-FR-001-01`, `TC-SR-FR-002-01`, `TC-SR-FR-005-01`, `TC-SR-FR-006-01`, `TC-SR-FR-008-01`, `TC-SR-FR-010-01` |
| Contract gate | `TC-SR-FR-002-02`, `TC-SR-FR-007-01`, `TC-SR-NFR-002-01`, `TC-SR-NFR-004-01` |
| Critical E2E gate | `TC-SR-FR-006-02`, `TC-SR-FR-008-02`, `TC-SR-FR-010-01`, `TC-SR-NFR-003-01` |

Regression pack total: `18` stable test IDs.

## Coverage Status

- P0/P1-critical requirements: `Full`
- partial rows in mandatory sections: `0`
- missing rows in mandatory sections: `0`

## Self-Check

- SR rows total / fully covered: `14 / 14`
- critical rows partial count (target: 0): `0`
- endpoints without mapped test IDs count (target: 0): `0`
- stories without requirement linkage count (target: 0): `0` (validated against master traceability doc)
