# Requirement-UseCase-Screen-Flow-Contract Traceability v2

Document-ID: MKT-DOC-TRACEABILITY-MASTER-V2
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-28
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

## A) Canonical Lineage Rules

1. Required lineage chain for each row:
   `FR/NFR -> SR -> Use Case -> Screen IDs -> Flow Docs -> Endpoint Contracts -> Data/Schema Contracts -> Acceptance Criteria -> Test Refs -> Story IDs`
2. Coverage states:
   - `Full`: all mandatory links exist.
   - `Partial`: one or more mandatory links missing.
   - `Missing`: lineage not established.
3. All P0/P1-critical requirements MUST be `Full`.
4. This document maps only approved, already-frozen behavior.

## B) Master Traceability Matrix (Complete Chain)

| FR/NFR Source | SR ID | Use Case(s) | Screen ID(s) | Flow Doc(s) | Endpoint Contract(s) | Data/Schema Contract(s) | Acceptance Criteria | Test Ref(s) | Story ID(s) | Coverage |
|---|---|---|---|---|---|---|---|---|---|---|
| `FR-33` | `SR-FR-001` | `L-02`, `P-01` | `S-LEAD-04`, `S-PART-02`, `S-PART-03` | `registration`, `edge_cases_and_failure_paths_v2` | `POST /api/v2/registrations`, `PATCH /api/v2/registrations/{registrationId}/status` | `participant_intake_schema`, `audit_event_schema` | `SR-FR-001-AC` | Step-07 `SR-FR-001` | `STORY-02-02` | Full |
| `FR-31`, `FR-32` | `SR-FR-002` | `P-01` | `S-PART-01`, `S-PART-02`, `S-PART-03` | `registration` | `POST /api/v2/registrations` | `participant_intake_schema` | `SR-FR-002-AC` | Step-07 `SR-FR-002`, 6.1 | `STORY-02-01` | Full |
| `FR-01`, `FR-02`, `FR-70` | `SR-FR-003` | `L-05` | `S-LEAD-01`, `S-LEAD-06` | `registration`, `cost_and_payment` | `GET /api/v2/dashboard/leader-workspace`, `GET /api/v2/registrations/{registrationId}` | `authz_tenant_endpoint_matrix`, `data_model` | `SR-FR-003-AC` | Step-07 `SR-FR-003` | `STORY-02-03` | Full |
| `FR-51`, `FR-53` | `SR-FR-004` | `L-04`, `P-03` | `S-LEAD-06`, `S-PART-04` | `cost_and_payment`, `edge_cases_and_failure_paths_v2` | `PATCH /api/v2/registrations/{registrationId}/payment` | `data_model`, `audit_event_schema` | `SR-FR-004-AC` | Step-07 `SR-FR-004` | `STORY-04-01` | Full |
| `FR-43`, `FR-44` | `SR-FR-005` | `L-03` | `S-LEAD-05`, `S-LEAD-04` | `waitlist`, `capacity_management`, `edge_cases_and_failure_paths_v2` | `POST /api/v2/waitlist-items`, `POST /api/v2/waitlist-items/{waitlistItemId}/convert`, `PATCH /api/v2/waitlist-items/{waitlistItemId}/cancel` | `audit_event_schema`, `data_model` | `SR-FR-005-AC` | Step-07 `SR-FR-005` | `STORY-03-01`, `STORY-03-02` | Full |
| `FR-61`, `FR-62` | `SR-FR-006` | `P-03`, `L-02` | `S-PART-03`, `S-PART-05`, `S-LEAD-04` | `telegram_integration`, `registration` | `PATCH /api/v2/registrations/{registrationId}/status`, `GET /api/v2/registrations/{registrationId}` | `authz_tenant_endpoint_matrix` | `SR-FR-006-AC` | Step-07 `SR-FR-006` | `STORY-05-01` | Full |
| `FR-71`, `FR-72` | `SR-FR-007` | `L-05` | `S-LEAD-06` | `cost_and_payment` | `GET /api/v2/reconciliation/export.csv` | `reconciliation_export_contract` | `SR-FR-007-AC` | Step-07 `SR-FR-007`, 6.3 | `STORY-04-02` | Full |
| `FR-10`, `FR-11`, `FR-12` | `SR-FR-008` | `I-01`, `I-02` | `S-ID-01`, `S-ID-02`, `S-PART-01` | `telegram_integration` | `POST /api/v2/auth/telegram/session`, `POST /api/v2/auth/web/session` | `participant_intake_schema`, `authz_tenant_endpoint_matrix` | `SR-FR-008-AC` | Step-07 `SR-FR-008` | `STORY-01-02` | Full |
| `FR-20` | `SR-FR-009` | `I-01`, `P-01` | `S-ID-01`, `S-PART-02` | `telegram_integration`, `registration` | `POST /api/v2/auth/telegram/session`, `POST /api/v2/registrations` | `participant_intake_schema`, `error_response_taxonomy_v2` | `SR-FR-009-AC` | Step-07 `SR-FR-009` | `STORY-01-02`, `STORY-02-01` | Full |
| `FR-22`, `FR-23` | `SR-FR-010` | `I-03` | `S-ID-03`, `S-PART-03` | `telegram_integration`, `edge_cases_and_failure_paths_v2` | `POST /api/v2/auth/link-telegram` | `authz_tenant_endpoint_matrix` | `SR-FR-010-AC` | Step-07 `SR-FR-010` | `STORY-01-02` | Full |
| `NFR-01` | `SR-NFR-001` | `L-01..L-05`, `P-01..P-03`, `I-01..I-03` | `S-LEAD-*`, `S-PART-*`, `S-ID-*` | `all core flows`, `edge_cases_and_failure_paths_v2` | `all /api/v2 protected endpoints` | `authz_tenant_endpoint_matrix`, `participant_intake_schema`, `audit_event_schema`, `reconciliation_export_contract` | `SR-NFR-001-AC` | Step-07 `SR-NFR-001`, Gate 7.2 | `STORY-01-01` | Full |
| `NFR-03` | `SR-NFR-002` | `L-02`, `L-03`, `L-04` | `S-LEAD-04`, `S-LEAD-05`, `S-LEAD-06` | `registration`, `waitlist`, `cost_and_payment`, `edge_cases_and_failure_paths_v2` | `POST /api/v2/registrations`, `PATCH /api/v2/registrations/{registrationId}/status`, `PATCH /api/v2/registrations/{registrationId}/payment`, `POST /api/v2/waitlist-items`, `POST /api/v2/waitlist-items/{waitlistItemId}/convert`, `PATCH /api/v2/waitlist-items/{waitlistItemId}/cancel` | `audit_event_schema` | `SR-NFR-002-AC` | Step-07 `SR-NFR-002`, Gate 7.3 | `STORY-06-01` | Full |
| `NFR-02`, `NFR-05` | `SR-NFR-003` | `L-02`, `L-05` | `S-LEAD-01`, `S-LEAD-04`, `S-LEAD-06` | `registration`, `cost_and_payment` | `GET /api/v2/dashboard/leader-workspace` | `screen_state_spec_v2` | `SR-NFR-003-AC` | Step-07 `SR-NFR-003` | `STORY-02-03` | Full |
| `NFR-05` | `SR-NFR-004` | `L-05` | `S-LEAD-06` | `cost_and_payment` | `GET /api/v2/reconciliation/export.csv` | `reconciliation_export_contract` | `SR-NFR-004-AC` | Step-07 `SR-NFR-004`, 6.3 | `STORY-04-02` | Full |

## C) Reverse Indexes

### C.1 Story -> Requirements Covered

| Story ID | Requirements Covered |
|---|---|
| `STORY-01-01` | `SR-NFR-001` |
| `STORY-01-02` | `SR-FR-008`, `SR-FR-009`, `SR-FR-010` |
| `STORY-02-01` | `SR-FR-002`, `SR-FR-009` |
| `STORY-02-02` | `SR-FR-001` |
| `STORY-02-03` | `SR-FR-003`, `SR-NFR-003` |
| `STORY-03-01` | `SR-FR-005` |
| `STORY-03-02` | `SR-FR-005`, `SR-FR-001` (conversion conflict guard) |
| `STORY-04-01` | `SR-FR-004` |
| `STORY-04-02` | `SR-FR-007`, `SR-NFR-004` |
| `STORY-05-01` | `SR-FR-006` |
| `STORY-06-01` | `SR-NFR-002` |

### C.2 Endpoint -> Requirements Covered

| Endpoint | Requirements Covered |
|---|---|
| `POST /api/v2/auth/telegram/session` | `SR-FR-008`, `SR-FR-009`, `SR-NFR-001` |
| `POST /api/v2/auth/web/session` | `SR-FR-008`, `SR-NFR-001` |
| `POST /api/v2/auth/link-telegram` | `SR-FR-010`, `SR-NFR-001` |
| `POST /api/v2/tours` | `SR-FR-003`, `SR-NFR-001` |
| `PATCH /api/v2/tours/{tour_id}` | `SR-FR-003`, `SR-NFR-001` |
| `POST /api/v2/registrations` | `SR-FR-001`, `SR-FR-002`, `SR-FR-008`, `SR-FR-009`, `SR-NFR-001`, `SR-NFR-002` |
| `GET /api/v2/registrations/{registrationId}` | `SR-FR-003`, `SR-FR-006`, `SR-NFR-001` |
| `PATCH /api/v2/registrations/{registrationId}/status` | `SR-FR-001`, `SR-FR-006`, `SR-NFR-001`, `SR-NFR-002` |
| `POST /api/v2/waitlist-items` | `SR-FR-005`, `SR-NFR-001`, `SR-NFR-002` |
| `POST /api/v2/waitlist-items/{waitlistItemId}/convert` | `SR-FR-005`, `SR-FR-001`, `SR-NFR-001`, `SR-NFR-002` |
| `PATCH /api/v2/waitlist-items/{waitlistItemId}/cancel` | `SR-FR-005`, `SR-NFR-001`, `SR-NFR-002` |
| `PATCH /api/v2/registrations/{registrationId}/payment` | `SR-FR-004`, `SR-NFR-001`, `SR-NFR-002` |
| `GET /api/v2/dashboard/leader-workspace` | `SR-FR-003`, `SR-NFR-001`, `SR-NFR-003` |
| `GET /api/v2/reconciliation/export.csv` | `SR-FR-007`, `SR-NFR-001`, `SR-NFR-004` |

### C.3 Screen -> Requirements Covered

| Screen ID | Requirements Covered |
|---|---|
| `S-LEAD-01` | `SR-FR-003`, `SR-NFR-003` |
| `S-LEAD-02` | `SR-FR-003` |
| `S-LEAD-03` | `SR-FR-003`, `SR-NFR-001` |
| `S-LEAD-04` | `SR-FR-001`, `SR-FR-006`, `SR-NFR-002` |
| `S-LEAD-05` | `SR-FR-005`, `SR-NFR-002` |
| `S-LEAD-06` | `SR-FR-004`, `SR-FR-007`, `SR-NFR-004` |
| `S-PART-01` | `SR-FR-002`, `SR-FR-008` |
| `S-PART-02` | `SR-FR-001`, `SR-FR-002`, `SR-FR-009` |
| `S-PART-03` | `SR-FR-001`, `SR-FR-006`, `SR-FR-010` |
| `S-PART-04` | `SR-FR-004` |
| `S-ID-01` | `SR-FR-008`, `SR-FR-009` |
| `S-ID-02` | `SR-FR-008`, `SR-FR-010` |
| `S-ID-03` | `SR-FR-010` |

## D) Coverage Gaps + Disposition

| Requirement ID | Coverage Status | Gap Description | Disposition |
|---|---|---|---|
| `SR-FR-001..SR-FR-010` | Full | None | Closed |
| `SR-NFR-001..SR-NFR-004` | Full | None | Closed |

P0/P1-critical gaps: `0`

## Self-Check

- SR rows total / fully covered: `14 / 14`
- critical rows partial count (target: 0): `0`
- endpoints without mapped test IDs count (target: 0): `0` (see `test_case_id_traceability_matrix_v2.md`)
- stories without requirement linkage count (target: 0): `0`
