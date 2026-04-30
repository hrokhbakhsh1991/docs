Document-ID: MKT-DOC-ANALYSIS-STEP-08
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Analysis Step 08: Execution Plan Baseline (Sprint-Wise)

## 1. Purpose

Define a practical sprint-by-sprint execution plan from the approved backlog, including dependencies, milestones, and release path.

---

## 2. Inputs

- `docs/30-analysis/step_06_implementation_backlog.md`
- `docs/30-analysis/step_07_test_strategy.md`
- `docs/30-analysis/step_05_pre_implementation.md`

---

## 3. Planning Assumptions

- Sprint length: 2 weeks
- MVP delivery focus: all `P0` stories + selected `P1` stories
- Quality gate policy from Step 07 is mandatory for release

---

## 4. Dependency Map (High-Level)

1. Tenant and identity foundation must land before most domain flows.
2. Registration intake and uniqueness must be ready before capacity/waitlist hardening.
3. Payment tracking baseline should exist before reconciliation export.
4. Audit events should be integrated before release hardening.

---

## 5. Sprint Plan

Kickoff view:
- Can start before Pre-Sprint-0 is fully passed: implementation scaffolding, test harness setup, and non-policy-dependent work in `STORY-01-02`, `STORY-02-01`, `STORY-02-02`, `STORY-03-01`, `STORY-03-02`, `STORY-05-01`.
- Soft-start only (prepare but do not merge) until related kickoff blockers are resolved: `STORY-01-01` (`OPEN-KICKOFF-001`, `OPEN-KICKOFF-002`), `STORY-04-01`/`STORY-04-02` (`OPEN-KICKOFF-003`), `STORY-06-01` (`OPEN-KICKOFF-004`, `OPEN-KICKOFF-005`).

## Pre-Sprint-0: Kickoff Gate (Policy Freeze)

Primary goal:
- freeze pre-implementation policy blockers before sprint execution

Gate criteria:
- tenant boundary precedence finalized (`CLAR-TNT-001`)
- admin MVP cross-tenant wording aligned in active docs (`CLAR-TNT-003`)
- payment source-of-truth decision finalized (`CLAR-017`)
- audit obligation level finalized (`CLAR-027`)
- transition-to-event coverage decision finalized (`CLAR-029`)
- intake unknown-field behavior finalized (`CLAR-034`)

Milestone:
- `MS-00` Policy freeze gate passed

Resolved execution note:
- Policy-gated items now execute under finalized backend decisions in `docs/40-clarifications/clarifications_backlog.md`.
- Audit is MANDATORY for every release-critical transition and missing audit events SHALL cause PRE-SPRINT-0 gate FAIL.
- Transition-to-event coverage must include non-happy paths; composite transitions MAY map to multiple events only when explicitly documented.
- Unknown top-level fields are STRICT REJECT across all channels and API versions and must be logged in intake logs.
- Decision Source: CLAR-TNT-001/CLAR-TNT-003/CLAR-017/CLAR-027/CLAR-029/CLAR-034 — 2026-04-28

---

## Sprint 1: Foundation and Entry Control

Primary goal:
- establish tenant safety and dual-mode identity entry

Scope:
- `STORY-01-01` Tenant Scope Enforcement (`P0`)
- `STORY-01-02` Dual-Mode Identity Entry (`P0`)
- baseline test harness for tenant and mode checks

Exit criteria:
- tenant isolation integration tests pass
- Telegram/web mode entry rules pass
- tenant precedence and fail-closed behavior are validated in tests (`CLAR-TNT-001`, `CLAR-005`)

Milestone:
- `MS-01` Secure access foundation complete

---

## Sprint 2: Registration Core and Intake Contracts

Primary goal:
- stabilize registration creation and validation layer

Scope:
- `STORY-02-01` Participant Intake Validation (`P0`)
- `STORY-02-02` Active Registration Uniqueness (`P0`)
- contract tests for intake schema

Exit criteria:
- required/conditional intake validations pass
- active registration duplication is blocked (including concurrency checks)
- intake unknown-field and error taxonomy behavior is fixed and testable (`CLAR-034`, `CLAR-033`)

Milestone:
- `MS-02` Registration core stable

---

## Sprint 3: Capacity and Waitlist Control

Primary goal:
- enforce capacity correctness and deterministic waitlist behavior

Scope:
- `STORY-03-01` Capacity Guard for Acceptance (`P0`)
- `STORY-03-02` FIFO Waitlist Conversion (`P0`)
- integration tests for full-capacity and conversion paths

Exit criteria:
- over-acceptance blocked
- FIFO conversion confirmed by test suite
- conversion/race semantics are deterministic and mapped to policy IDs (`CLAR-008`, `CLAR-009`, `CLAR-012`)

Milestone:
- `MS-03` Capacity/waitlist reliability achieved

---

## Sprint 4: Payment State and Link Governance

Primary goal:
- close operational loop for leader decision flow

Scope:
- `STORY-04-01` Payment Status Recording (`P0`)
- `STORY-05-01` Accepted-Only Link Access (`P0`)
- add selected `P1` if capacity allows:
  - `STORY-02-03` Leader Operational Visibility

Exit criteria:
- payment status workflow stable
- communication link access policy fully enforced
- payment status/amount/source-of-truth rules are consistent with canonical decisions (`CLAR-015`, `CLAR-016`, `CLAR-017`)

Milestone:
- `MS-04` End-to-end leader decision loop complete

---

## Sprint 5: Reconciliation, Audit, and Release Hardening

Primary goal:
- complete release-readiness controls and exports

Scope:
- `STORY-04-02` Reconciliation Export (`P1`)
- `STORY-06-01` Critical Status Audit Events (`P1`)
- execute release gates from Step 07

Exit criteria:
- export contract tests pass
- audit event completeness validated
- all release gates pass
- transition-to-event mapping and KPI traceability are complete for release-critical paths (`CLAR-029`, `CLAR-028`, `CLAR-030`)

Milestone:
- `MS-05` MVP release candidate approved

---

## 6. Release Path

## 6.1 MVP Release Candidate Criteria

- all P0 stories delivered and accepted
- no unresolved `S1` defects
- tenant safety gate passed
- critical journey E2E gate passed

## 6.2 Post-MVP Stabilization Window

- monitor defect intake
- patch critical regressions
- confirm operational adoption metrics

---

## 7. Execution Risks and Mitigations

- Risk: identity integration delays  
  Mitigation: isolate Telegram linking as separate tested story

- Risk: capacity/waitlist race issues  
  Mitigation: prioritize transactional and concurrency tests in Sprint 3

- Risk: export schema drift  
  Mitigation: lock contract tests before release gate

- Risk: cross-tenant leakage  
  Mitigation: continuous negative tenant-scope tests in CI

---

## 8. Tracking Model

Minimum tracking fields per story:

- story ID
- sprint assignment
- owner
- status (`Not Started`, `In Progress`, `Blocked`, `Done`)
- linked SR IDs
- linked test suite IDs

---

## 9. Step-08 Completion Criteria

Step 08 is complete when:

- sprint sequence is defined and dependency-aware
- milestones and release path are explicit
- P0/P1 delivery boundaries are clear
- execution risks have practical mitigations

---

## Changelog

- 2026-04-28: Added Pre-Sprint-0 gate criteria for `CLAR-029` and `CLAR-034`.
- 2026-04-28: Added decision-pending execution note for backend policy-gated items.
- 2026-04-28: Replaced decision-pending execution note with resolved backend policy execution rules and hard-fail audit gating. — Decision Source: CLAR-TNT-001/CLAR-TNT-003/CLAR-017/CLAR-027/CLAR-029/CLAR-034 — 2026-04-28
