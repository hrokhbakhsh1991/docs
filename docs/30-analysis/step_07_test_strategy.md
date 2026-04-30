Document-ID: MKT-DOC-ANALYSIS-STEP-07
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Analysis Step 07: Test Strategy Baseline

## 1. Purpose

Define a requirement-driven test strategy that ensures MVP quality gates are measurable before release.

---

## 2. Inputs

- `docs/30-analysis/step_03_system_requirements.md`
- `docs/30-analysis/step_06_implementation_backlog.md`
- `docs/20-architecture/flows/*.md`
- `docs/20-architecture/contracts/*.md`

---

## 3. Test Scope

This strategy covers:

- functional behavior for `SR-FR-*`
- non-functional checks for `SR-NFR-*`
- schema/contract conformance
- release-blocking quality gates

---

## 4. Test Pyramid

## 4.1 Unit Tests (largest layer)

Focus:
- validation rules
- status transition guards
- utility functions and mappers

Targets:
- intake field validation
- enum enforcement
- uniqueness checks
- waitlist selection logic

## 4.2 Integration Tests (middle layer)

Focus:
- endpoint + service + persistence interactions
- tenant boundary enforcement
- transactional consistency

Targets:
- registration creation and duplicate prevention
- acceptance/capacity consistency
- waitlist conversion workflow
- payment status update behavior
- audit event creation
- export contract generation

## 4.3 End-to-End Tests (top layer)

Focus:
- user-visible critical journeys
- dual-mode policy correctness

Targets:
- Telegram-mode registration path
- web-mode registration path + `Connect Telegram`
- leader review and acceptance path
- accepted-only link visibility
- per-tour reconciliation export

---

## 5. Requirement-to-Test Matrix

| Requirement | Test Type | Critical Test Scenarios |
|---|---|---|
| `SR-FR-001` | Unit + Integration | reject second active registration; race-condition duplicate attempts |
| `SR-FR-002` | Unit + Integration | reject missing mandatory fields; conditional Telegram field checks |
| `SR-FR-003` | Integration + E2E | leader workspace state aggregation accuracy |
| `SR-FR-004` | Unit + Integration | payment enum validation and state persistence |
| `SR-FR-005` | Unit + Integration | FIFO selection correctness, conflict-safe conversion |
| `SR-FR-006` | Integration + E2E | non-accepted link denial and accepted access |
| `SR-FR-007` | Integration + E2E | reconciliation output contains required columns/records |
| `SR-FR-008` | E2E | equal business rule behavior across both entry modes |
| `SR-FR-009` | Integration + E2E | Telegram-mode identity requirement enforcement |
| `SR-FR-010` | E2E | web users can discover and execute account linking path |
| `SR-NFR-001` | Integration + Security | cross-tenant access denial |
| `SR-NFR-002` | Integration | actor/timestamp audit event completeness |
| `SR-NFR-003` | E2E + UX validation | leader decision path without external dependency |
| `SR-NFR-004` | Integration + Contract | stable CSV schema and order |

---

## 6. Contract Test Set (Schema Lock)

## 6.1 Intake Contract Tests

Source:
- `docs/20-architecture/contracts/participant_intake_schema.md`

Must verify:
- required fields
- conditional fields
- canonical initial statuses

## 6.2 Audit Contract Tests

Source:
- `docs/20-architecture/contracts/audit_event_schema.md`

Must verify:
- event immutability
- actor/old/new/timestamp presence
- tenant-scoped retrieval

## 6.3 Export Contract Tests

Source:
- `docs/20-architecture/contracts/reconciliation_export_contract.md`

Must verify:
- required headers
- required order
- canonical enum values
- CSV parse compatibility

---

## 7. Release Gates (Go/No-Go)

## 7.0 Tenant & Policy Release Gates (Pre-Sprint-0 Alignment)

This section defines the minimum policy-proof test set that must pass to align with `docs/30-analysis/step_08_execution_plan.md` Pre-Sprint-0 gate.

Policy-linked minimum coverage:

- `CLAR-TNT-001` (tenant precedence):
  - integration tests for trusted-signal precedence conflicts (auth vs route vs payload)
  - negative tests for missing/ambiguous tenant context with fail-closed expectation
- `CLAR-TNT-003` (admin scope in MVP):
  - authorization tests proving no cross-tenant admin read/write/export in MVP
  - explicit denial-path tests for admin attempts outside tenant boundary
- `CLAR-017` (payment source-of-truth):
  - integration tests proving canonical source is consistently used in read and export paths
  - mismatch classification tests when registration payment fields and payment records diverge
- `CLAR-027` (audit obligation level):
  - contract tests proving mandatory audit emission for release-critical transitions
  - negative tests proving missing audit event is treated as release-gate failure

Pre-Sprint-0 test gate pass criteria:
- all policy-linked suites above are green in CI baseline run
- no unresolved blocker defect against tenant/admin/payment-truth/audit-obligation policies

Resolved policy note:
- Final sign-off uses resolved backend decisions from `docs/40-clarifications/clarifications_backlog.md` for `CLAR-TNT-001`, `CLAR-TNT-003`, `CLAR-017`, `CLAR-027`, `CLAR-029`, and `CLAR-034`.
- Decision Source: CLAR-TNT-001/CLAR-TNT-003/CLAR-017/CLAR-027/CLAR-029/CLAR-034 — 2026-04-28

---

## 7.1 Gate A: Functional Gate (P0)

Must pass:
- all P0 story acceptance tests
- zero open blocker defects on `SR-FR-001..006,008..010`

## 7.2 Gate B: Tenant Safety Gate

Must pass:
- cross-tenant isolation test suite (`SR-NFR-001`)
- no known tenant leakage defects
- tenant precedence conflict/missing-context fail-closed tests (`CLAR-TNT-001`)
- admin cross-tenant denial tests in MVP scope (`CLAR-TNT-003`)

## 7.3 Gate C: Contract Gate

Must pass:
- intake schema contract tests
- audit schema contract tests
- export schema contract tests
- payment source-of-truth consistency tests (`CLAR-017`)
- mandatory audit-obligation contract checks (`CLAR-027`)
- transition-to-event completeness checks including non-happy paths (`CLAR-029`)
- unknown top-level field strict reject checks across channels and API versions (`CLAR-034`)

## 7.4 Gate D: Critical Journey E2E Gate

Must pass:
- Telegram-mode critical path
- web-mode critical path
- leader operational decision path
- reconciliation export path
- all Pre-Sprint-0 policy-linked critical journeys remain green (`CLAR-TNT-001`, `CLAR-TNT-003`, `CLAR-017`, `CLAR-027`)

---

## 8. Defect Severity Policy

- `S1` (Blocker): tenant leak, status corruption, impossible critical flow
- `S2` (Major): wrong capacity/waitlist behavior, broken reconciliation contract
- `S3` (Minor): non-blocking UI/wording inconsistency

Release rule:
- `S1` count MUST be zero
- unresolved `S2` MUST have explicit approved risk acceptance

---

## 9. Step-07 Completion Criteria

Step 07 is complete when:

- requirement-to-test matrix is finalized
- release gates are explicit and measurable
- contract test baselines are locked
- defect severity policy is agreed

---

## Changelog

- 2026-04-28: Added backend decision-pending note linking release-authoritative gate sign-off to unresolved CLAR decisions.
- 2026-04-28: Replaced backend decision-pending note with resolved CLAR policy baseline for gate sign-off. — Decision Source: CLAR-TNT-001/CLAR-TNT-003/CLAR-017/CLAR-027/CLAR-029/CLAR-034 — 2026-04-28
