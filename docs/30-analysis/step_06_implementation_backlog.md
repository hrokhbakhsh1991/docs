Document-ID: MKT-DOC-ANALYSIS-STEP-06
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-28
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Analysis Step 06: Implementation Backlog Baseline

## 1. Purpose

Convert approved analysis outputs into an implementation-ready backlog using:

- `Epic -> Story -> Task`
- traceability to `SR-FR/SR-NFR`
- explicit acceptance criteria and Definition of Done

---

## 2. Inputs

- `docs/30-analysis/step_03_system_requirements.md`
- `docs/20-architecture/contracts/participant_intake_schema.md`
- `docs/20-architecture/contracts/audit_event_schema.md`
- `docs/20-architecture/contracts/reconciliation_export_contract.md`
- `docs/20-architecture/flows/*.md`

---

## 3. Prioritization Model

- `P0`: MVP-critical, blocks core operation if missing
- `P1`: MVP-strongly recommended, high operational value
- `P2`: MVP+ or optimization

---

## 4. Backlog (Epic -> Story -> Task)

## EPIC-01: Tenant and Identity Foundation (`P0`)

Traceability:
- `SR-FR-008`, `SR-FR-009`, `SR-FR-010`, `SR-NFR-001`

### STORY-01-01: Tenant Scope Enforcement (`P0`)

Kickoff-ready: YES (Readiness-State: `READY`)

Readiness normalization:
- Block reason category: `POLICY_ALIGNMENT_PENDING` -> resolved
- Required dependency artifact/decision:
  - `docs/30-analysis/step_08_execution_plan.md` (`Pre-Sprint-0: Kickoff Gate`, `Resolved execution note`)
  - `docs/30-analysis/step_07_test_strategy.md` (`7.0 Tenant & Policy Release Gates`, `Resolved policy note`)
  - `docs/20-architecture/contracts/authz_tenant_endpoint_matrix_v2.md` (`Endpoint Matrix`, `Tenant Enforcement Invariants`)
- Exact acceptance criteria to unblock:
  - tenant precedence/fail-closed policy is frozen in execution/test strategy artifacts
  - endpoint-level tenant enforcement matrix is published and maps to `SR-NFR-001`
  - policy-linked tests are explicitly defined for pre-sprint gate
- Owner: `Engineering Lead (Backend Platform)`
- Due date: `2026-04-30`
- Verification evidence:
  - `docs/30-analysis/step_08_execution_plan.md`
  - `docs/30-analysis/step_07_test_strategy.md`
  - `docs/20-architecture/contracts/authz_tenant_endpoint_matrix_v2.md`
- Status transition rule: `Blocked -> Ready` when all three verification artifacts exist and policy freeze is marked resolved.

Acceptance:
- cross-tenant access attempts fail closed
- all operational queries resolve tenant context

Clarification dependencies:
- `CLAR-TNT-001`, `CLAR-TNT-003`, `CLAR-005`

Tasks:
- `TASK-01-01-01` Add tenant scope middleware/policy for operational endpoints.
- `TASK-01-01-02` Add tenant-aware filtering in registration/payment/waitlist reads. (`Reference-CLAR:CLAR-TNT-004`)
- `TASK-01-01-03` Add negative tests for cross-tenant access.

Definition of Done:
- automated tests pass for tenant boundary checks
- no endpoint returns foreign-tenant records

### STORY-01-02: Dual-Mode Identity Entry (`P0`)

Kickoff-ready: YES (Readiness-State: `READY`)

Acceptance:
- Telegram mode requires valid Telegram identity context
- web mode allows onboarding without Telegram
- `Connect Telegram` path exists in web mode

Clarification dependencies:
- `CLAR-003`, `CLAR-021`, `CLAR-022`

Tasks:
- `TASK-01-02-01` Implement Telegram-mode auth entry guard.
- `TASK-01-02-02` Implement standalone web onboarding entry.
- `TASK-01-02-03` Implement post-onboarding account-linking endpoint/action.
- `TASK-01-02-04` Add integration tests for mode-specific identity behavior.

Definition of Done:
- both modes can authenticate according to policy
- link path is reachable and test-covered

---

## EPIC-02: Registration Core (`P0`)

Traceability:
- `SR-FR-001`, `SR-FR-002`, `SR-FR-003`
- `docs/20-architecture/contracts/participant_intake_schema.md`

### STORY-02-01: Participant Intake Validation (`P0`)

Kickoff-ready: YES (Readiness-State: `READY`)

Acceptance:
- missing mandatory fields reject request
- Telegram-mode conditional fields validated
- valid payload creates pending registration

Clarification dependencies:
- `CLAR-034`, `CLAR-033`

Tasks:
- `TASK-02-01-01` Implement required field validation from intake schema.
- `TASK-02-01-02` Implement entry-mode conditional validation.
- `TASK-02-01-03` Add standardized validation error payload. (`Reference-CLAR:CLAR-033`)
- `TASK-02-01-04` Add unit tests for valid/invalid payload permutations.

Definition of Done:
- schema validations deterministic
- error responses consistent and documented

### STORY-02-02: Active Registration Uniqueness (`P0`)

Kickoff-ready: YES (Readiness-State: `READY`)

Acceptance:
- second active registration (`Pending`/`Accepted`) for same `(user,tour)` is rejected

Clarification dependencies:
- `CLAR-011`, `CLAR-023`

Tasks:
- `TASK-02-02-01` Add uniqueness guard in service layer.
- `TASK-02-02-02` Add persistence/index strategy for active uniqueness enforcement.
- `TASK-02-02-03` Add concurrent-request test coverage.

Definition of Done:
- duplicate active registration cannot be created under race conditions

### STORY-02-03: Leader Operational Visibility (`P1`)

Kickoff-ready: YES (Readiness-State: `READY`)

Readiness normalization:
- Block reason category: `WORKSPACE_CONTRACT_NOT_FROZEN` -> resolved
- Required dependency artifact/decision:
  - `docs/20-architecture/contracts/api_endpoint_contracts_v2.md` (`GET /api/v2/dashboard/leader-workspace`)
  - `docs/10-product/screen_state_spec_v2.md` (`S-LEAD-01`, `S-LEAD-06`)
  - `docs/50-validation/requirement_usecase_screen_flow_contract_traceability_v2.md` (row `SR-FR-003`, row `SR-NFR-003`)
- Exact acceptance criteria to unblock:
  - dashboard endpoint contract is explicit with request/response/errors
  - UI state coverage for leader workspace screens is complete
  - requirement-to-story traceability for visibility requirements is `Full`
- Owner: `Frontend Lead + Backend API Lead`
- Due date: `2026-04-30`
- Verification evidence:
  - `docs/20-architecture/contracts/api_endpoint_contracts_v2.md`
  - `docs/10-product/screen_state_spec_v2.md`
  - `docs/50-validation/requirement_usecase_screen_flow_contract_traceability_v2.md`
- Status transition rule: `Blocked -> Ready` when workspace endpoint + screen states + traceability row are all published and consistent.

Acceptance:
- leader workspace displays registration/payment/capacity state in one view

Clarification dependencies:
- `CLAR-017`, `CLAR-TNT-006`

Tasks:
- `TASK-02-03-01` Build aggregated query contract for workspace overview.
- `TASK-02-03-02` Implement workspace summary API.
- `TASK-02-03-03` Add UI data mapping and empty/error state handling.

Definition of Done:
- leader can review core operational state without external tracking sheet

---

## EPIC-03: Capacity and Waitlist (`P0`)

Traceability:
- `SR-FR-005`
- `docs/20-architecture/flows/capacity_management.md`
- `docs/20-architecture/flows/waitlist.md`

### STORY-03-01: Capacity Guard for Acceptance (`P0`)

Kickoff-ready: YES (Readiness-State: `READY`)

Acceptance:
- status transition to `Accepted` blocked when capacity is full

Clarification dependencies:
- `CLAR-009`, `CLAR-022`

Tasks:
- `TASK-03-01-01` Implement capacity check before acceptance transition.
- `TASK-03-01-02` Add transactional protection for accepted-count consistency.
- `TASK-03-01-03` Add tests for boundary conditions (`accepted_count == total_capacity`).

Definition of Done:
- over-acceptance cannot occur

### STORY-03-02: FIFO Waitlist Conversion (`P0`)

Kickoff-ready: YES (Readiness-State: `READY`)

Acceptance:
- earliest eligible waitlist item converts first
- no simultaneous active waitlist+registration conflict

Clarification dependencies:
- `CLAR-008`, `CLAR-012`, `CLAR-013`

Tasks:
- `TASK-03-02-01` Implement FIFO selector for `Waiting` items.
- `TASK-03-02-02` Implement conversion workflow (`Waiting` -> `Converted` + registration path). (`Reference-CLAR:CLAR-008`)
- `TASK-03-02-03` Add conflict guard checks for active records.
- `TASK-03-02-04` Add deterministic integration tests for queue order.

Definition of Done:
- queue order preserved under normal and concurrent operations

---

## EPIC-04: Payment Tracking and Reconciliation (`P1`)

Traceability:
- `SR-FR-004`, `SR-FR-007`, `SR-NFR-004`
- `docs/20-architecture/contracts/reconciliation_export_contract.md`

### STORY-04-01: Payment Status Recording (`P0`)

Kickoff-ready: YES (Readiness-State: `READY`)

Readiness normalization:
- Block reason category: `PAYMENT_CONTRACT_GAP` -> resolved
- Required dependency artifact/decision:
  - `docs/20-architecture/contracts/api_endpoint_contracts_v2.md` (`PATCH /api/v2/registrations/{registrationId}/payment`)
  - `docs/20-architecture/flows/edge_cases_and_failure_paths_v2.md` (`EC-PAY-001..004`)
  - `docs/10-product/form_validation_ux_contract_v2.md` (validation rows for `payment_status`, `paid_amount`)
- Exact acceptance criteria to unblock:
  - canonical payment endpoint contract is explicit and test-derivable
  - payment edge cases are deterministic with requirement+endpoint+test mapping
  - validation UX behavior for payment updates is fully specified
- Owner: `Payments Domain Lead`
- Due date: `2026-04-30`
- Verification evidence:
  - `docs/20-architecture/contracts/api_endpoint_contracts_v2.md`
  - `docs/20-architecture/flows/edge_cases_and_failure_paths_v2.md`
  - `docs/10-product/form_validation_ux_contract_v2.md`
- Status transition rule: `Blocked -> Ready` when payment endpoint, validation contract, and payment edge matrix are all frozen.

Acceptance:
- payment status accepts only canonical enum values
- paid amount rules are validated consistently

Clarification dependencies:
- `CLAR-015`, `CLAR-016`, `CLAR-017`

Tasks:
- `TASK-04-01-01` Implement payment status validation (`NotPaid`,`Partial`,`Paid`).
- `TASK-04-01-02` Implement paid amount consistency rules. (`Reference-CLAR:CLAR-015`)
- `TASK-04-01-03` Add API and UI-level validation feedback.

Definition of Done:
- invalid payment state transitions are impossible through normal API paths

### STORY-04-02: Reconciliation Export (`P1`)

Kickoff-ready: YES (Readiness-State: `READY`)

Readiness normalization:
- Block reason category: `EXPORT_TEST_GATE_UNALIGNED` -> resolved
- Required dependency artifact/decision:
  - `docs/20-architecture/contracts/api_endpoint_contracts_v2.md` (`GET /api/v2/reconciliation/export.csv`)
  - `docs/50-validation/test_case_id_traceability_matrix_v2.md` (`TC-SR-FR-007-01`, `TC-SR-FR-007-02`, `TC-SR-NFR-004-01`, `TC-SR-NFR-004-02`)
  - `docs/30-analysis/step_07_test_strategy.md` (`6.3 Export Contract Tests`, `7.3 Gate C`)
- Exact acceptance criteria to unblock:
  - export endpoint contract and CSV contract tests are explicitly linked
  - stable test IDs exist for schema/order and snapshot consistency
  - release gate includes export checks with deterministic pass criteria
- Owner: `Data Export Owner + QA Lead`
- Due date: `2026-04-30`
- Verification evidence:
  - `docs/20-architecture/contracts/api_endpoint_contracts_v2.md`
  - `docs/50-validation/test_case_id_traceability_matrix_v2.md`
  - `docs/30-analysis/step_07_test_strategy.md`
- Status transition rule: `Blocked -> Ready` when export endpoint + test IDs + gate criteria are all present and cross-referenced.

Acceptance:
- CSV export includes required columns in stable order
- export is tenant/tour scoped

Clarification dependencies:
- `CLAR-018`, `CLAR-017`

Tasks:
- `TASK-04-02-01` Implement export query aligned with column contract.
- `TASK-04-02-02` Implement CSV serializer with header and escaping rules.
- `TASK-04-02-03` Add contract test for schema/order stability. (`Reference-CLAR:CLAR-018`)

Definition of Done:
- export parses successfully in standard spreadsheet tools

---

## EPIC-05: Telegram Link Governance (`P0`)

Traceability:
- `SR-FR-006`
- `docs/20-architecture/flows/telegram_integration.md`

### STORY-05-01: Accepted-Only Link Access (`P0`)

Kickoff-ready: YES (Readiness-State: `READY`)

Acceptance:
- only accepted registrations can view/retrieve tour communication link

Clarification dependencies:
- `CLAR-021`, `CLAR-026`

Tasks:
- `TASK-05-01-01` Implement link visibility guard by registration status.
- `TASK-05-01-02` Add endpoint/UI tests for non-accepted denial.
- `TASK-05-01-03` Add audit marker for link access attempts (optional in MVP if low effort).

Definition of Done:
- link access policy enforced consistently across modes

---

## EPIC-06: Auditability (`P1`)

Traceability:
- `SR-NFR-002`
- `docs/20-architecture/contracts/audit_event_schema.md`

### STORY-06-01: Critical Status Audit Events (`P1`)

Kickoff-ready: YES (Readiness-State: `READY`)

Readiness normalization:
- Block reason category: `AUDIT_GATE_UNCERTAINTY` -> resolved
- Required dependency artifact/decision:
  - `docs/30-analysis/step_07_test_strategy.md` (`7.0 Tenant & Policy Release Gates`, `7.3 Gate C`, resolved CLAR note)
  - `docs/20-architecture/contracts/authz_tenant_endpoint_matrix_v2.md` (`6. Audit Emission Matrix`)
  - `docs/20-architecture/contracts/api_endpoint_contracts_v2.md` (`SR-NFR-002` mapping row)
- Exact acceptance criteria to unblock:
  - critical audit events are explicitly marked `Critical-MUST`
  - `SR-NFR-002` coverage references only `Critical-MUST` events
  - gate checks include mandatory audit emission and non-happy transition coverage
- Owner: `Platform Reliability Lead + QA Lead`
- Due date: `2026-04-30`
- Verification evidence:
  - `docs/30-analysis/step_07_test_strategy.md`
  - `docs/20-architecture/contracts/authz_tenant_endpoint_matrix_v2.md`
  - `docs/20-architecture/contracts/api_endpoint_contracts_v2.md`
- Status transition rule: `Blocked -> Ready` when audit matrix, SR mapping, and gate checks are all aligned to `Critical-MUST`.

Acceptance:
- critical transitions emit immutable tenant-scoped audit events

Clarification dependencies:
- `CLAR-027`, `CLAR-029`

Tasks:
- `TASK-06-01-01` Implement audit event writer for status-changing operations. (`Reference-CLAR:CLAR-027`, `Reference-OPEN:OPEN-KICKOFF-004`)
- `TASK-06-01-02` Persist actor, old/new value, timestamp, tenant scope fields.
- `TASK-06-01-03` Add audit retrieval filters with tenant safety. (`Reference-CLAR:CLAR-TNT-001`, `Reference-OPEN:OPEN-KICKOFF-001`)
- `TASK-06-01-04` Add integration tests for event completeness.

Definition of Done:
- required status transitions are traceable via event log

---

## 5. MVP Delivery Cutline

### Must-Implement (Release Blockers)

- EPIC-01: STORY-01-01, STORY-01-02
- EPIC-02: STORY-02-01, STORY-02-02
- EPIC-03: STORY-03-01, STORY-03-02
- EPIC-04: STORY-04-01
- EPIC-05: STORY-05-01

### Should-Implement (High Value)

- EPIC-02: STORY-02-03
- EPIC-04: STORY-04-02
- EPIC-06: STORY-06-01

---

## 6. Execution Readiness Checklist

- [ ] Each P0 story has owner and estimate.
- [ ] Each P0 story has linked acceptance tests.
- [ ] Dependency order across epics is agreed.
- [ ] Definition of Done is adopted by engineering and QA.

---

## 7. Step-06 Completion Criteria

Step 06 is complete when:

- implementation backlog exists with stable IDs
- every story is traceable to finalized requirements
- MVP cutline is explicit and execution-ready
