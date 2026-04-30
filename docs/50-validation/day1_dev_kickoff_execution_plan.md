# Day-1 Dev Kickoff Execution Plan

Document-ID: MKT-DOC-DAY1-DEV-KICKOFF-PLAN
Version: v1.0
Status: Active
Owner: Engineering Lead
Last-Updated: 2026-04-28
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

## Objective

Start Day-1 implementation on the approved `READY_TO_BUILD: YES` baseline without behavior drift, while preserving strict traceability from code changes to `SR-*` and `TC-*`.

## Day-1 Scope Selection (Top-Risk P0 Stories)

| Story ID | Selected Why (Risk-First) | Day-1 Slice Boundary |
|---|---|---|
| `STORY-01-01` Tenant Scope Enforcement | Cross-tenant leakage is highest systemic risk and fail-closed is mandatory for all protected operations. | Core middleware/policy + tenant predicates + negative boundary tests |
| `STORY-02-01` Participant Intake Validation | Intake is highest-volume write path; validation drift causes FE/BE mismatch and support load. | Deterministic schema validation + canonical error envelope + unit/contract tests |
| `STORY-02-02` Active Registration Uniqueness | Duplicate active registration under concurrency is high-impact data integrity risk. | Service guard + persistence constraint + race-condition integration tests |

## Authoritative References Used

- `docs/50-validation/final_pre_dev_sanity_check_v2.md`
- `docs/50-validation/pre_dev_gate_decision_memo_v2.md`
- `docs/30-analysis/step_06_implementation_backlog.md`
- `docs/50-validation/requirement_usecase_screen_flow_contract_traceability_v2.md`
- `docs/50-validation/test_case_id_traceability_matrix_v2.md`
- `docs/20-architecture/contracts/api_endpoint_contracts_v2.md`
- `docs/20-architecture/contracts/error_response_taxonomy_v2.md`
- `docs/20-architecture/contracts/authz_tenant_endpoint_matrix_v2.md`
- `docs/10-product/wireflows_must_have_journeys_v2.md`
- `docs/10-product/screen_state_spec_v2.md`
- `docs/10-product/form_validation_ux_contract_v2.md`

## Story Task Breakdown (Backend / Frontend / Test) with SR + Test IDs

### STORY-01-01: Tenant Scope Enforcement (`P0`)

| Task ID | Stream | Owner | Executable Task | SR Mapping | Test ID Mapping | Acceptance Evidence |
|---|---|---|---|---|---|---|
| `D1-TASK-01-01` | Backend | Backend Platform Lead | Implement trusted tenant context resolver and fail-closed middleware for protected `/api/v2/*` endpoints. | `SR-NFR-001` | `TC-SR-NFR-001-01` | Middleware integration log + request/response evidence for missing-context denial |
| `D1-TASK-01-02` | Backend | Backend API Lead | Add tenant predicate enforcement on by-id reads/writes for registrations and waitlist operations. | `SR-NFR-001` | `TC-SR-NFR-001-02` | Query/repository diff + negative access test output (cross-tenant denied) |
| `D1-TASK-01-03` | Frontend | Frontend Lead | Map tenant/auth fail-closed errors (`TENANT_CONTEXT_MISSING`, `TENANT_SCOPE_CONFLICT`, `TENANT_SCOPE_FORBIDDEN`) to `permission_denied` state in impacted screens. | `SR-NFR-001` | `TC-SR-NFR-001-02` | Screen capture of `permission_denied` state path + error-code mapping note |
| `D1-TASK-01-04` | Test | QA Lead | Add tenant-boundary negative integration suite for protected endpoints in day-1 scope. | `SR-NFR-001` | `TC-SR-NFR-001-01`, `TC-SR-NFR-001-02` | CI/test report with per-endpoint pass matrix |

Day-1 Definition of Done:
- Tenant context missing/conflict always fails closed.
- Cross-tenant reads/writes are denied or scoped-not-found.
- At least `TC-SR-NFR-001-01` and `TC-SR-NFR-001-02` pass and are attached.

### STORY-02-01: Participant Intake Validation (`P0`)

| Task ID | Stream | Owner | Executable Task | SR Mapping | Test ID Mapping | Acceptance Evidence |
|---|---|---|---|---|---|---|
| `D1-TASK-02-01` | Backend | Backend API Lead | Implement required/enum/format/conditional validation for `POST /api/v2/registrations` aligned to intake schema. | `SR-FR-002`, `SR-FR-009` | `TC-SR-FR-002-01`, `TC-SR-FR-002-02`, `TC-SR-FR-009-01` | Validation rule coverage report + failing/passing payload fixtures |
| `D1-TASK-02-02` | Backend | Backend API Lead | Enforce canonical error envelope and canonical codes for validation/auth-context failures. | `SR-FR-002`, `SR-FR-009` | `TC-SR-FR-002-01`, `TC-SR-FR-009-01` | Contract test output with exact `error.code`, `details`, `retryability` |
| `D1-TASK-02-03` | Frontend | Frontend Lead | Bind validation and auth-context errors to `S-PART-02` inline/banner/blocking semantics per UX contract. | `SR-FR-002`, `SR-FR-009` | `TC-SR-FR-002-01`, `TC-SR-FR-009-01` | UI state evidence (inline + banner + blocking) with error-code map |
| `D1-TASK-02-04` | Test | QA Lead | Add unit + contract tests for required field, enum invalid, unknown field, Telegram conditional/missing context. | `SR-FR-002`, `SR-FR-009` | `TC-SR-FR-002-01`, `TC-SR-FR-002-02`, `TC-SR-FR-009-01` | Test run artifact with per-case oracle assertion |

Day-1 Definition of Done:
- `POST /api/v2/registrations` rejects invalid payloads deterministically.
- FE handling on `S-PART-02` matches documented state semantics.
- `TC-SR-FR-002-01`, `TC-SR-FR-002-02`, `TC-SR-FR-009-01` pass.

### STORY-02-02: Active Registration Uniqueness (`P0`)

| Task ID | Stream | Owner | Executable Task | SR Mapping | Test ID Mapping | Acceptance Evidence |
|---|---|---|---|---|---|---|
| `D1-TASK-02-05` | Backend | Backend Domain Lead (Registration) | Implement service-layer guard preventing second active (`Pending|Accepted`) registration for same `(user_id, tour_id)`. | `SR-FR-001` | `TC-SR-FR-001-01` | Service test output proving duplicate reject with canonical error |
| `D1-TASK-02-06` | Backend | Backend Data Lead | Add persistence-level uniqueness strategy for active states (index/constraint/transactional guard). | `SR-FR-001` | `TC-SR-FR-001-01`, `TC-SR-FR-001-02` | Migration/constraint evidence + concurrent write test log |
| `D1-TASK-02-07` | Frontend | Frontend Lead | Handle `REGISTRATION_DUPLICATE_ACTIVE` in `S-PART-02` as deterministic corrective state. | `SR-FR-001` | `TC-SR-FR-001-01` | UI evidence for duplicate-active path and user action |
| `D1-TASK-02-08` | Test | QA Lead | Add concurrency integration tests for duplicate active and status race conflict (`CONCURRENCY_CONFLICT`). | `SR-FR-001` | `TC-SR-FR-001-01`, `TC-SR-FR-001-02` | Integration report showing one-winner conflict behavior |

Day-1 Definition of Done:
- Duplicate active creation is blocked in normal and concurrent paths.
- Conflict result uses canonical error code semantics.
- `TC-SR-FR-001-01` and `TC-SR-FR-001-02` pass.

## Risk Notes and Rollback Strategy

| Risk ID | Risk | Impact | Mitigation | Rollback Strategy |
|---|---|---|---|---|
| `D1-RISK-01` | Tenant enforcement applied inconsistently across endpoints | Security/data isolation breach | Central middleware + endpoint conformance checklist + negative test gate | Revert tenant middleware change-set and restore previous endpoint guard set; keep feature flag OFF until conformance passes |
| `D1-RISK-02` | Validation behavior diverges between FE and BE | UX inconsistency and support churn | Single source from canonical error taxonomy + contract tests on envelope | Roll back FE error mapping to last stable keys and keep BE canonical response enabled |
| `D1-RISK-03` | Uniqueness strategy causes write deadlocks/perf regression | Registration write instability | Load-test focused on registration create path and lock scope review | Disable strict persistence constraint via migration rollback and rely on service guard temporarily with incident note |
| `D1-RISK-04` | Silent divergence from approved docs during implementation | Traceability and gate failure | Mandatory doc-sync logging for every detected divergence | Halt merge for affected PR and open `DOC-SYNC` item before code merge |

## Divergence Handling Rule (Doc-Sync)

If implementation reveals a mismatch with approved docs:
1. Do NOT silently alter behavior.
2. Open `DOC-SYNC-<date>-<seq>` item in progress log with:
   - impacted endpoint/screen/story
   - observed divergence
   - authoritative reference
   - proposed disposition (`code-align` or `doc-change-review`)
3. Block merge until disposition is approved.

## End-of-Day Gate (Day-1)

| Metric | Target | Day-1 EOD Record |
|---|---:|---:|
| implemented tasks count | `8` | `TBD` |
| passed test IDs count | `>= 9` | `TBD` |
| failed/blocked count | `0` (or explicit blockers logged) | `TBD` |
| doc-sync issues count | `0` (or all explicitly tracked) | `TBD` |
| Day-2 recommendation | `Go / Conditional Go / No-Go` with rationale | `TBD` |

## Day-2 Candidate Recommendation Logic

- **Go:** all planned day-1 tasks completed, no unresolved blocker, critical test IDs pass.
- **Conditional Go:** minor non-critical blocker exists with workaround and no policy/security breach.
- **No-Go:** tenant boundary or uniqueness guarantees fail in tests, or unresolved doc-sync conflict remains.
