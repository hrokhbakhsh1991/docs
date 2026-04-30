# spec_clarification_backlog_v1_EN

## Executive Summary
1. This backlog operationalizes cross-document clarification gaps already detected in the active v2 document set.
2. It focuses on specification clarity, not implementation tasks, for a leader-centric, tenant-isolated Tour Operations platform.
3. Highest-risk gaps are in tenant trust boundary, state transitions, payment invariants, audit obligations, and KPI-event mapping.
4. Several rules are present at policy level but lack API/domain enforcement semantics (error classes, retries, idempotency, conflict handling).
5. Registration/Waitlist/Payment machines have partial definitions and missing forbidden transitions.
6. Identity continuity between Telegram and Web modes is conceptually present but not formalized as a stateful policy.
7. Audit/event requirements conflict in obligation strength and completeness, reducing telemetry trustworthiness.
8. KPI baselines require event sources and formulas that are not fully frozen in the audit/event schema.
9. Governance artifacts mandate ADR/architecture rigor, but current packaging is incomplete and drift-prone.
10. The items below define measurable clarification deliverables and canonical destinations for a stable pre-development baseline.

## P0/P1 Quick List (IDs only)
- **P0:** CLAR-001, CLAR-002, CLAR-003, CLAR-004, CLAR-005, CLAR-006, CLAR-007, CLAR-008, CLAR-009, CLAR-010, CLAR-011, CLAR-015, CLAR-016, CLAR-017, CLAR-018, CLAR-019, CLAR-027, CLAR-028, CLAR-029, CLAR-030
- **P1:** CLAR-012, CLAR-013, CLAR-014, CLAR-020, CLAR-021, CLAR-022, CLAR-023, CLAR-024, CLAR-025, CLAR-026, CLAR-031, CLAR-032, CLAR-033, CLAR-034

## Canonicalization Mapping

| Rule Type | Proposed Canonical Source | Referencing Documents |
|---|---|---|
| Requirement IDs & normative obligations | `docs/30-analysis/step_03_system_requirements.md` | `docs/10-product/requirements.md`, `docs/20-architecture/technical_spec.md`, flow docs, step 06/07/08/09 |
| Domain invariants | `docs/20-architecture/data_model.md` | flow docs, `docs/20-architecture/technical_spec.md`, step 03, step 07 |
| State machine transitions/guards/actors | `docs/20-architecture/flows/*.md` + `docs/50-validation/flow_consistency_validation.md` index | step 03, `docs/20-architecture/technical_spec.md`, step 07 |
| API semantics (errors, retry, idempotency, conflict) | `docs/20-architecture/technical_spec.md` | step 03, step 04 contracts, step 07 |
| Events & KPI mapping | `docs/20-architecture/contracts/audit_event_schema.md` + `docs/30-analysis/step_09_kpi_monitoring.md` | step 07, step 08 |
| Security/Tenant trust boundary | `docs/20-architecture/technical_spec.md` + `docs/20-architecture/data_model.md` | intake schema, flow docs, step 03, step 07 |
| Governance/ADR/architecture packaging | `docs/00-governance/documentation_governance.md` | `docs/20-architecture/decisions.md`, `docs/00-governance/readme.md`, roadmap docs |

---

- ID: CLAR-001
  - Domain Area: Tenant
  - Problem Type: Missing Policy
  - Severity: P0 Blocker
  - Symptom (what diverges / what is missing): Tenant-scoped requirement exists, but no explicit tenant context resolution order (auth/session/payload/route).
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/30-analysis/step_03_system_requirements.md` (SR-NFR-001), `docs/20-architecture/technical_spec.md` (tenant isolation/auth context), `docs/20-architecture/contracts/participant_intake_schema.md` (required `tenant_id`).
  - Clarification Questions (bullet list):
    - What is the canonical precedence for tenant resolution across request layers?
    - Is client-provided `tenant_id` authoritative, advisory, or ignored when auth context exists?
    - What response class applies to tenant mismatch?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): `docs/40-clarifications/tenant_boundary_policy.md` (canonical in technical/security layer).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Defines tenant resolution order in one normative table.
    - Defines mismatch outcomes for all endpoint classes.
    - Referenced by intake schema and test strategy.
  - Proposed Owner: Security
  - Dependencies (IDs of other CLAR items, if any): None

- ID: CLAR-002
  - Domain Area: Tenant
  - Problem Type: Invariant Gap
  - Severity: P0 Blocker
  - Symptom (what diverges / what is missing): No explicit invariant that every read/write/export query must enforce tenant predicate.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/10-product/requirements.md` (tenant isolation FR/NFR), `docs/20-architecture/contracts/reconciliation_export_contract.md` (tenant+tour scope), `docs/20-architecture/technical_spec.md` (API/data isolation statements).
  - Clarification Questions (bullet list):
    - Is tenant filter mandatory for all operational query types, including exports and dashboards?
    - Are there any exception endpoints?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): `docs/40-clarifications/data_access_tenant_invariants.md` (canonical in data model layer).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Includes invariant list with query classes.
    - Includes explicit exception policy (if any).
    - Mapped to negative tests in step 07.
  - Proposed Owner: Architect
  - Dependencies (IDs of other CLAR items, if any): CLAR-001

- ID: CLAR-003
  - Domain Area: Tenant
  - Problem Type: Ambiguous Definition
  - Severity: P0 Blocker
  - Symptom (what diverges / what is missing): Participant tenant context source is described conceptually but not formalized for all entry modes.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/20-architecture/technical_spec.md` (participant context resolution), `docs/50-validation/flow_consistency_validation.md` (tenant-scoped consistency), `docs/20-architecture/contracts/participant_intake_schema.md` (`entry_mode`, `tenant_id` fields).
  - Clarification Questions (bullet list):
    - How is tenant derived for Telegram mode versus Web mode?
    - Can participant context switch tenant in-session?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): `docs/40-clarifications/participant_context_resolution_contract.md`.
  - Acceptance Criteria (bullet list; measurable/testable):
    - Defines mode-specific tenant derivation steps.
    - Defines forbidden context-switch behavior.
  - Proposed Owner: Tech Lead
  - Dependencies (IDs of other CLAR items, if any): CLAR-001

- ID: CLAR-004
  - Domain Area: Tenant
  - Problem Type: Traceability Gap
  - Severity: P0 Blocker
  - Symptom (what diverges / what is missing): Cross-tenant denial behavior is not traceably mapped to requirement IDs and test cases.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/30-analysis/step_03_system_requirements.md` (SR-NFR-001), `docs/30-analysis/step_07_test_strategy.md` (security/negative tests), `docs/30-analysis/step_08_execution_plan.md` (execution gates).
  - Clarification Questions (bullet list):
    - Which exact negative tenant scenarios are release-blocking?
    - Which IDs link each scenario to acceptance criteria?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): `docs/40-clarifications/tenant_traceability_matrix.md`.
  - Acceptance Criteria (bullet list; measurable/testable):
    - Scenario-to-ID mapping complete for API/UI/export.
    - Includes release gate references.
  - Proposed Owner: QA
  - Dependencies (IDs of other CLAR items, if any): CLAR-001, CLAR-002

- ID: CLAR-005
  - Domain Area: Tenant
  - Problem Type: Missing Policy
  - Severity: P0 Blocker
  - Symptom (what diverges / what is missing): No explicit fail-closed rule set for missing/invalid tenant context.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/20-architecture/technical_spec.md` (auth/access), `docs/10-product/requirements.md` (tenant isolation expectations).
  - Clarification Questions (bullet list):
    - What is default behavior when tenant context is absent or ambiguous?
    - Is soft fallback ever allowed?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): `docs/40-clarifications/tenant_fail_closed_policy.md`.
  - Acceptance Criteria (bullet list; measurable/testable):
    - Enumerates all missing-context failure paths.
    - Declares no silent fallback unless explicitly listed.
  - Proposed Owner: Security
  - Dependencies (IDs of other CLAR items, if any): CLAR-001

- ID: CLAR-006
  - Domain Area: Tenant
  - Problem Type: NFR Quantification
  - Severity: P0 Blocker
  - Symptom (what diverges / what is missing): Tenant isolation is mandatory but no measurable production threshold/SLO is defined in KPI/testing baseline.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/30-analysis/step_09_kpi_monitoring.md` (cross-tenant incident KPI), `docs/30-analysis/step_07_test_strategy.md`, `docs/30-analysis/step_03_system_requirements.md`.
  - Clarification Questions (bullet list):
    - What quantitative threshold defines tenant-isolation pass/fail for release?
    - Which event signals count as tenant incident?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): `docs/40-clarifications/tenant_isolation_nfr_targets.md`.
  - Acceptance Criteria (bullet list; measurable/testable):
    - Defines numeric thresholds and observation window.
    - Mapped to KPI IDs and test gates.
  - Proposed Owner: Architect
  - Dependencies (IDs of other CLAR items, if any): CLAR-027, CLAR-029

- ID: CLAR-007
  - Domain Area: Registration
  - Problem Type: State Machine Gap
  - Severity: P0 Blocker
  - Symptom (what diverges / what is missing): Registration states exist, but complete formal transition matrix is not centralized.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/10-product/requirements.md` (registration statuses), `docs/20-architecture/data_model.md` (status enums), `docs/20-architecture/flows/registration.md`, `docs/30-analysis/step_03_system_requirements.md` (SR-FR-001/006).
  - Clarification Questions (bullet list):
    - What are all allowed from→to transitions?
    - Which transitions are forbidden explicitly?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `registration_state_machine_contract_v1_EN` (non-local, not yet created) (canonical under flows).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Table includes from, to, actor, guard, side-effect.
    - Forbidden transitions listed explicitly.
  - Proposed Owner: Architect
  - Dependencies (IDs of other CLAR items, if any): CLAR-003

- ID: CLAR-008
  - Domain Area: Waitlist
  - Problem Type: State Machine Gap
  - Severity: P0 Blocker
  - Symptom (what diverges / what is missing): Waitlist conversion is policy-defined (FIFO) but atomic conversion behavior is not formalized.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/20-architecture/flows/waitlist.md` (FIFO conversion), `docs/20-architecture/data_model.md` (waitlist states), `docs/30-analysis/step_03_system_requirements.md` (SR-FR-005), `docs/30-analysis/step_07_test_strategy.md`.
  - Clarification Questions (bullet list):
    - What is the exact conversion sequence and transaction boundary?
    - What is deterministic behavior when conversion conflicts with new registration?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `waitlist_conversion_contract_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Defines atomic steps and conflict outcomes.
    - Includes idempotent re-run semantics.
  - Proposed Owner: Tech Lead
  - Dependencies (IDs of other CLAR items, if any): CLAR-011, CLAR-022

- ID: CLAR-009
  - Domain Area: Capacity
  - Problem Type: State Machine Gap
  - Severity: P0 Blocker
  - Symptom (what diverges / what is missing): Capacity guard exists but concurrent accept race winner/loser semantics are unspecified.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/20-architecture/flows/capacity_management.md`, `docs/20-architecture/technical_spec.md` (race protection mention), `docs/30-analysis/step_07_test_strategy.md`.
  - Clarification Questions (bullet list):
    - What is canonical conflict resolution under simultaneous accept attempts?
    - Which state/result must the losing request return?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `capacity_concurrency_semantics_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Defines deterministic winner/loser semantics.
    - Mapped to concurrency test scenarios.
  - Proposed Owner: Architect
  - Dependencies (IDs of other CLAR items, if any): CLAR-007, CLAR-022

- ID: CLAR-010
  - Domain Area: Registration
  - Problem Type: Ambiguous Definition
  - Severity: P0 Blocker
  - Symptom (what diverges / what is missing): `NoShow` exists as a status but operational triggers and side-effects are not consistently defined.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/10-product/requirements.md`, `docs/20-architecture/data_model.md`, `docs/20-architecture/flows/registration.md`, `docs/30-analysis/step_07_test_strategy.md`.
  - Clarification Questions (bullet list):
    - What event/actor triggers transition to `NoShow`?
    - Does `NoShow` affect capacity and waitlist progression?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `registration_noshow_operational_definition_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Defines allowed transitions into/out of `NoShow`.
    - Defines capacity and audit side-effects.
  - Proposed Owner: PM
  - Dependencies (IDs of other CLAR items, if any): CLAR-007, CLAR-029

- ID: CLAR-011
  - Domain Area: Registration
  - Problem Type: Invariant Gap
  - Severity: P0 Blocker
  - Symptom (what diverges / what is missing): Active uniqueness invariant exists, but no formal conflict classification for duplicate attempts under race/retry.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/30-analysis/step_03_system_requirements.md` (SR-FR-001), `docs/20-architecture/flows/registration.md`, `docs/20-architecture/technical_spec.md`, `docs/30-analysis/step_07_test_strategy.md`.
  - Clarification Questions (bullet list):
    - Is duplicate active registration always conflict (not validation)?
    - How is replay of same intent distinguished from distinct competing requests?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `registration_uniqueness_conflict_contract_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Defines response class for each duplicate scenario.
    - Includes retry and concurrency cases.
  - Proposed Owner: Tech Lead
  - Dependencies (IDs of other CLAR items, if any): CLAR-022, CLAR-023

- ID: CLAR-012
  - Domain Area: Waitlist
  - Problem Type: Missing Policy
  - Severity: P1 High
  - Symptom (what diverges / what is missing): FIFO policy exists, but tie-breaker for same timestamp is not formalized.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/30-analysis/step_03_system_requirements.md` (SR-FR-005), `docs/20-architecture/flows/waitlist.md`.
  - Clarification Questions (bullet list):
    - What deterministic secondary ordering key is canonical?
    - Is ordering stable across retries and reprocessing?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `waitlist_fifo_ordering_rules_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Specifies primary and secondary ordering keys.
    - Includes deterministic examples.
  - Proposed Owner: Architect
  - Dependencies (IDs of other CLAR items, if any): CLAR-008

- ID: CLAR-013
  - Domain Area: Waitlist
  - Problem Type: Missing Policy
  - Severity: P1 High
  - Symptom (what diverges / what is missing): Leader override/swap behavior in waitlist is not formally specified.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/20-architecture/flows/waitlist.md`, `docs/50-validation/flow_consistency_validation.md`, `docs/30-analysis/step_07_test_strategy.md`.
  - Clarification Questions (bullet list):
    - Is manual reorder/override allowed?
    - If allowed, what audit and reason fields are mandatory?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `waitlist_override_policy_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Declares allow/deny for overrides.
    - Defines audit requirements for override events.
  - Proposed Owner: PM
  - Dependencies (IDs of other CLAR items, if any): CLAR-029

- ID: CLAR-014
  - Domain Area: Registration
  - Problem Type: Ambiguous Definition
  - Severity: P1 High
  - Symptom (what diverges / what is missing): Pending timeout/escalation is raised but not closed as a formal rule.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/30-analysis/step_01_business_mission.md` (open questions), `docs/30-analysis/step_02_stakeholder_needs.md`, `docs/30-analysis/step_03_system_requirements.md`.
  - Clarification Questions (bullet list):
    - Is there a timeout for `Pending`?
    - What is post-timeout transition and actor responsibility?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `registration_pending_timeout_policy_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Defines timeout duration and resulting state/action.
    - Referenced in flow and test strategy.
  - Proposed Owner: PM
  - Dependencies (IDs of other CLAR items, if any): CLAR-007

- ID: CLAR-015
  - Domain Area: Payment
  - Problem Type: Invariant Gap
  - Severity: P0 Blocker
  - Symptom (what diverges / what is missing): Payment statuses exist but `paid_amount` algebra vs status is not formally defined.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/10-product/requirements.md`, `docs/20-architecture/data_model.md`, `docs/20-architecture/flows/cost_and_payment.md`, `docs/30-analysis/step_03_system_requirements.md` (SR-FR-004).
  - Clarification Questions (bullet list):
    - What exact numeric relationship defines `NotPaid`, `Partial`, `Paid`?
    - Are rounding and currency precision rules specified?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `payment_amount_status_invariants_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Includes algebraic rules for all statuses.
    - Includes invalid combination examples.
  - Proposed Owner: Architect
  - Dependencies (IDs of other CLAR items, if any): None

- ID: CLAR-016
  - Domain Area: Payment
  - Problem Type: State Machine Gap
  - Severity: P0 Blocker
  - Symptom (what diverges / what is missing): No formal payment transition graph (allowed/forbidden from→to).
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/20-architecture/data_model.md`, `docs/20-architecture/flows/cost_and_payment.md`, `docs/20-architecture/technical_spec.md`, `docs/30-analysis/step_07_test_strategy.md`.
  - Clarification Questions (bullet list):
    - Which payment transitions are allowed?
    - Are rollback transitions permitted and under what conditions?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `payment_state_machine_contract_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Transition matrix includes actor and guard.
    - Forbidden transitions explicitly listed.
  - Proposed Owner: Tech Lead
  - Dependencies (IDs of other CLAR items, if any): CLAR-015

- ID: CLAR-017
  - Domain Area: Payment
  - Problem Type: Conflict
  - Severity: P0 Blocker
  - Status: Resolved
  - Decision: Payment record is authoritative source-of-truth for read/export operations. Registration is a preliminary source; on mismatch, follow policy: 'Retry (up to 3x) then Reject and create reconciliations task'.
  - Decision Source: CLAR-017 — 2026-04-28
  - Symptom (what diverges / what is missing): Payment truth in MVP is on registration fields, while separate payment records also exist conceptually.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/20-architecture/data_model.md` (truth ownership), `docs/20-architecture/flows/cost_and_payment.md`, `docs/10-product/requirements.md`.
  - Clarification Questions (bullet list):
    - Which field/entity is authoritative at read and export time?
    - How are mismatches between registration payment fields and payment records handled?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `payment_source_of_truth_policy_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Declares single authoritative source per use case.
    - Declares mismatch handling classification.
  - Proposed Owner: Architect
  - Dependencies (IDs of other CLAR items, if any): CLAR-015

- ID: CLAR-018
  - Domain Area: Payment
  - Problem Type: Traceability Gap
  - Severity: P0 Blocker
  - Symptom (what diverges / what is missing): Reconciliation export relies on payment fields but snapshot semantics and consistency window are unclear.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/20-architecture/contracts/reconciliation_export_contract.md`, `docs/30-analysis/step_03_system_requirements.md` (SR-FR-007), `docs/30-analysis/step_07_test_strategy.md`.
  - Clarification Questions (bullet list):
    - Is export snapshot-consistent or stream-consistent?
    - What happens if payment updates occur during export generation?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `reconciliation_consistency_semantics_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Defines consistency model and timestamp semantics.
    - Includes testable race scenario expectations.
  - Proposed Owner: QA
  - Dependencies (IDs of other CLAR items, if any): CLAR-016

- ID: CLAR-019
  - Domain Area: Payment
  - Problem Type: Missing Policy
  - Severity: P0 Blocker
  - Symptom (what diverges / what is missing): Financial correction/back-adjustment policy is not formalized.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/20-architecture/flows/cost_and_payment.md`, `docs/30-analysis/step_07_test_strategy.md`, `docs/10-product/requirements.md`.
  - Clarification Questions (bullet list):
    - Are downward status corrections allowed after `Paid`?
    - What metadata/audit fields are mandatory for corrections?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `payment_adjustment_policy_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Declares permitted correction paths.
    - Declares mandatory audit annotations.
  - Proposed Owner: PM
  - Dependencies (IDs of other CLAR items, if any): CLAR-016, CLAR-029

- ID: CLAR-020
  - Domain Area: Payment
  - Problem Type: NFR Quantification
  - Severity: P1 High
  - Symptom (what diverges / what is missing): Payment quality KPIs exist conceptually but no quantified acceptance thresholds for data quality drift.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/30-analysis/step_09_kpi_monitoring.md`, `docs/30-analysis/step_07_test_strategy.md`, `docs/30-analysis/step_08_execution_plan.md`.
  - Clarification Questions (bullet list):
    - What KPI thresholds define acceptable payment-state data quality?
    - Which events are minimum required for payment KPI trust?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `payment_kpi_quality_thresholds_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Numeric thresholds and windows defined.
    - Event-source mapping per KPI declared.
  - Proposed Owner: QA
  - Dependencies (IDs of other CLAR items, if any): CLAR-030, CLAR-031

- ID: CLAR-021
  - Domain Area: Identity
  - Problem Type: Missing Policy
  - Severity: P1 High
  - Symptom (what diverges / what is missing): Web-to-Telegram linking is required/expected but formal linking state model is absent.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/10-product/requirements.md` (dual mode), `docs/20-architecture/technical_spec.md` (connect flow), `docs/20-architecture/flows/telegram_integration.md`.
  - Clarification Questions (bullet list):
    - What are canonical linking states (e.g., unlinked, linked, failed)?
    - Which transitions require re-verification?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `identity_linking_state_model_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - State and transition table exists.
    - Referenced by Telegram flow and technical spec.
  - Proposed Owner: Architect
  - Dependencies (IDs of other CLAR items, if any): CLAR-022

- ID: CLAR-022
  - Domain Area: Identity
  - Problem Type: Missing Policy
  - Severity: P1 High
  - Symptom (what diverges / what is missing): No idempotency semantics for repeated link/connect callbacks.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/20-architecture/technical_spec.md`, `docs/20-architecture/flows/telegram_integration.md`, `docs/30-analysis/step_07_test_strategy.md`.
  - Clarification Questions (bullet list):
    - How should duplicate linking requests be classified and handled?
    - What identifies same-intent replay?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `identity_linking_idempotency_contract_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Defines replay-safe behavior.
    - Defines response class for duplicate callbacks.
  - Proposed Owner: Tech Lead
  - Dependencies (IDs of other CLAR items, if any): CLAR-021

- ID: CLAR-023
  - Domain Area: API Semantics
  - Problem Type: Missing Policy
  - Severity: P1 High
  - Symptom (what diverges / what is missing): Retry/idempotency semantics for create/update/convert operations are not defined.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/20-architecture/technical_spec.md`, `docs/30-analysis/step_07_test_strategy.md`, `docs/20-architecture/flows/registration.md`, `docs/20-architecture/flows/waitlist.md`.
  - Clarification Questions (bullet list):
    - Which endpoints require idempotency guarantees?
    - What is canonical retry behavior by error class?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `api_idempotency_retry_semantics_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Endpoint matrix with idempotency requirement exists.
    - Retryable vs non-retryable classification exists.
  - Proposed Owner: Tech Lead
  - Dependencies (IDs of other CLAR items, if any): CLAR-036

- ID: CLAR-024
  - Domain Area: Identity
  - Problem Type: Conflict
  - Severity: P1 High
  - Symptom (what diverges / what is missing): Mismatch scenarios between web identity and Telegram identity are acknowledged but unresolved.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/20-architecture/flows/telegram_integration.md`, `docs/10-product/requirements.md`, `docs/20-architecture/technical_spec.md`.
  - Clarification Questions (bullet list):
    - What is canonical behavior when Telegram account maps to a different existing web identity?
    - Is manual review required for specific mismatch classes?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `identity_mismatch_resolution_policy_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Lists mismatch classes and expected outcomes.
    - Traceable to test cases in step 07.
  - Proposed Owner: Security
  - Dependencies (IDs of other CLAR items, if any): CLAR-021

- ID: CLAR-025
  - Domain Area: Identity
  - Problem Type: Ambiguous Definition
  - Severity: P1 High
  - Symptom (what diverges / what is missing): One-to-one vs one-to-many constraints for Telegram linkage are not formalized.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/20-architecture/data_model.md`, `docs/20-architecture/technical_spec.md`, `docs/20-architecture/flows/telegram_integration.md`.
  - Clarification Questions (bullet list):
    - Can one Telegram account be linked to multiple platform users?
    - Can one user hold multiple Telegram identities?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `identity_cardinality_constraints_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Cardinality rules declared with examples.
    - Includes conflict classification for violations.
  - Proposed Owner: Architect
  - Dependencies (IDs of other CLAR items, if any): CLAR-021

- ID: CLAR-026
  - Domain Area: Identity
  - Problem Type: Traceability Gap
  - Severity: P1 High
  - Symptom (what diverges / what is missing): Identity-linking requirements are not fully linked to explicit acceptance tests.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/10-product/requirements.md`, `docs/30-analysis/step_07_test_strategy.md`, `docs/30-analysis/step_08_execution_plan.md`.
  - Clarification Questions (bullet list):
    - Which identity scenarios are release-gating?
    - Which requirement IDs own each scenario?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `identity_traceability_matrix_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Complete mapping requirement → test case.
    - Gate criteria defined for release.
  - Proposed Owner: QA
  - Dependencies (IDs of other CLAR items, if any): CLAR-021, CLAR-024

- ID: CLAR-027
  - Domain Area: Audit
  - Problem Type: Conflict
  - Severity: P0 Blocker
  - Status: Resolved
  - Decision: Audit is MANDATORY for every release-critical transition. Missing audit events SHALL cause PRE-SPRINT-0 gate FAIL.
  - Decision Source: CLAR-027 — 2026-04-28
  - Symptom (what diverges / what is missing): Audit obligation level is inconsistent across documents (SHOULD vs strict per-transition event requirement).
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/30-analysis/step_03_system_requirements.md` (SR-NFR-002), `docs/20-architecture/contracts/audit_event_schema.md` (exactly one event per transition), `docs/30-analysis/step_07_test_strategy.md`.
  - Clarification Questions (bullet list):
    - What is final normative obligation level for audit event emission?
    - Which transitions are mandatory audit-critical?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `audit_obligation_baseline_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Obligation level unified and cited by ID.
    - Mandatory transition-event map defined.
  - Proposed Owner: Architect
  - Dependencies (IDs of other CLAR items, if any): CLAR-029

- ID: CLAR-028
  - Domain Area: Event & KPI
  - Problem Type: Traceability Gap
  - Severity: P0 Blocker
  - Symptom (what diverges / what is missing): KPI definitions require event sources not fully frozen in event schema.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/30-analysis/step_09_kpi_monitoring.md`, `docs/20-architecture/contracts/audit_event_schema.md`.
  - Clarification Questions (bullet list):
    - Which exact event types feed each KPI?
    - Which KPI has no current event source?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `kpi_event_traceability_matrix_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Each KPI maps to one or more event types.
    - No KPI remains unmapped.
  - Proposed Owner: QA
  - Dependencies (IDs of other CLAR items, if any): CLAR-027

- ID: CLAR-029
  - Domain Area: Audit
  - Problem Type: Invariant Gap
  - Severity: P0 Blocker
  - Status: Resolved
  - Decision: All transitions—including non-happy paths—must map to events. Composite transitions MAY map to multiple events if explicitly documented.
  - Decision Source: CLAR-029 — 2026-04-28
  - Symptom (what diverges / what is missing): Event-per-transition rule exists but deterministic transition-event coupling is not fully enumerated.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/20-architecture/contracts/audit_event_schema.md`, `docs/20-architecture/flows/registration.md`, `docs/20-architecture/flows/waitlist.md`, `docs/20-architecture/flows/cost_and_payment.md`.
  - Clarification Questions (bullet list):
    - For each transition, what exact event type/version is required?
    - Are composite transitions allowed to emit multiple events?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `transition_to_event_contract_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Transition-to-event matrix complete for all machines.
    - Includes old/new state payload requirements.
  - Proposed Owner: Architect
  - Dependencies (IDs of other CLAR items, if any): CLAR-007, CLAR-008, CLAR-016

- ID: CLAR-030
  - Domain Area: Observability
  - Problem Type: Missing Policy
  - Severity: P0 Blocker
  - Symptom (what diverges / what is missing): KPI formulas/windows/dedup semantics are incomplete for reliable telemetry.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/30-analysis/step_09_kpi_monitoring.md`, `docs/20-architecture/contracts/audit_event_schema.md`.
  - Clarification Questions (bullet list):
    - What is the canonical formula and denominator per KPI?
    - How are retries/duplicates/out-of-order events handled in KPI computation?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `kpi_computation_semantics_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Formula and window defined for each KPI.
    - Dedup and ordering policy explicitly defined.
  - Proposed Owner: QA
  - Dependencies (IDs of other CLAR items, if any): CLAR-028

- ID: CLAR-031
  - Domain Area: Event & KPI
  - Problem Type: Missing Policy
  - Severity: P1 High
  - Symptom (what diverges / what is missing): Event catalog versioning and backward compatibility policy is not explicit.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/20-architecture/contracts/audit_event_schema.md`, `docs/30-analysis/step_09_kpi_monitoring.md`.
  - Clarification Questions (bullet list):
    - How are event schema changes versioned?
    - How do KPI pipelines handle mixed event versions?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `event_schema_versioning_policy_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Versioning rules declared.
    - Compatibility handling rules declared.
  - Proposed Owner: Architect
  - Dependencies (IDs of other CLAR items, if any): CLAR-028

- ID: CLAR-032
  - Domain Area: Observability
  - Problem Type: NFR Quantification
  - Severity: P1 High
  - Symptom (what diverges / what is missing): Event completeness and freshness SLOs are not quantified.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/30-analysis/step_09_kpi_monitoring.md`, `docs/30-analysis/step_08_execution_plan.md`, `docs/30-analysis/step_07_test_strategy.md`.
  - Clarification Questions (bullet list):
    - What completeness percentage is required for trusted KPI reporting?
    - What max ingestion delay is acceptable?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `observability_slo_baseline_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Completeness and latency thresholds are numeric.
    - Linked to release gates.
  - Proposed Owner: QA
  - Dependencies (IDs of other CLAR items, if any): CLAR-030

- ID: CLAR-033
  - Domain Area: API Semantics
  - Problem Type: Missing Policy
  - Severity: P1 High
  - Symptom (what diverges / what is missing): Error taxonomy is incomplete across validation/conflict/authz/transient classes.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/20-architecture/technical_spec.md`, `docs/20-architecture/contracts/participant_intake_schema.md`, `docs/30-analysis/step_07_test_strategy.md`.
  - Clarification Questions (bullet list):
    - What canonical error classes exist?
    - Which class applies to capacity-full, duplicate-active, tenant mismatch, invalid enum?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `api_error_taxonomy_contract_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Error class dictionary complete.
    - Endpoint-to-error mapping provided.
  - Proposed Owner: Tech Lead
  - Dependencies (IDs of other CLAR items, if any): CLAR-023

- ID: CLAR-034
  - Domain Area: API Semantics
  - Problem Type: Ambiguous Definition
  - Severity: P1 High
  - Status: Resolved
  - Decision: Unknown-field policy: STRICT REJECT across all channels and API versions. Incoming payloads with unknown top-level fields must be rejected; record the rejection in intake logs.
  - Decision Source: CLAR-034 — 2026-04-28
  - Symptom (what diverges / what is missing): Intake unknown-field handling is explicitly undecided (ignore vs reject).
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/20-architecture/contracts/participant_intake_schema.md` (unknown field policy note), `docs/30-analysis/step_07_test_strategy.md`.
  - Clarification Questions (bullet list):
    - Is unknown field policy strict reject or permissive ignore?
    - Is behavior uniform across API versions and modes?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `intake_unknown_field_policy_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - One global policy declared.
    - Test cases reflect chosen policy.
  - Proposed Owner: PM
  - Dependencies (IDs of other CLAR items, if any): CLAR-033

- ID: CLAR-035
  - Domain Area: Governance
  - Problem Type: Conflict
  - Severity: P2 Medium
  - Symptom (what diverges / what is missing): Requirement ID schemes diverge across documents (FR/NFR vs SR-FR/SR-NFR).
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/00-governance/documentation_standard.md`, `docs/30-analysis/step_03_system_requirements.md`, `docs/10-product/requirements.md`.
  - Clarification Questions (bullet list):
    - What is final authoritative requirement ID scheme?
    - Is bi-directional mapping mandatory for legacy IDs?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `requirement_id_canonical_policy_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Single canonical ID scheme declared.
    - Migration mapping table included.
  - Proposed Owner: PM
  - Dependencies (IDs of other CLAR items, if any): None

- ID: CLAR-036
  - Domain Area: Governance
  - Problem Type: Traceability Gap
  - Severity: P2 Medium
  - Symptom (what diverges / what is missing): End-to-end traceability is distributed, not consolidated into one operational RTM.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/30-analysis/step_03_system_requirements.md`, `docs/30-analysis/step_06_implementation_backlog.md`, `docs/30-analysis/step_07_test_strategy.md`, `docs/30-analysis/step_09_kpi_monitoring.md`.
  - Clarification Questions (bullet list):
    - Which artifact is canonical RTM owner?
    - What minimum columns are mandatory (Objective→Req→Flow→API→Test→KPI)?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `end_to_end_traceability_matrix_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Every P0/P1 requirement row has full chain coverage.
    - No orphan requirement/test/KPI rows.
  - Proposed Owner: QA
  - Dependencies (IDs of other CLAR items, if any): CLAR-035

- ID: CLAR-037
  - Domain Area: Governance
  - Problem Type: Missing Policy
  - Severity: P2 Medium
  - Symptom (what diverges / what is missing): ADR governance expectations exist but decision records are not consistently in full ADR form.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/00-governance/documentation_governance.md` (ADR expectations), `docs/20-architecture/decisions.md`.
  - Clarification Questions (bullet list):
    - Which decisions require full ADR mandatory conversion?
    - What is minimum ADR schema for this project?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `adr_packaging_policy_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Decision set classified by ADR requirement.
    - ADR template fields declared mandatory.
  - Proposed Owner: Architect
  - Dependencies (IDs of other CLAR items, if any): None

- ID: CLAR-038
  - Domain Area: Governance
  - Problem Type: Missing Policy
  - Severity: P2 Medium
  - Symptom (what diverges / what is missing): Architecture packaging (C4/arc42) is required in governance but not fully operationalized as required artifact list.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/00-governance/documentation_governance.md`, `docs/20-architecture/technical_spec.md`, `docs/00-governance/readme.md`.
  - Clarification Questions (bullet list):
    - Which architecture artifacts are release-blocking?
    - What minimum completion criteria apply to each artifact?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `architecture_artifact_minimums_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Artifact checklist and gate criteria defined.
    - Ownership and review cadence defined.
  - Proposed Owner: Architect
  - Dependencies (IDs of other CLAR items, if any): CLAR-037

- ID: CLAR-039
  - Domain Area: Governance
  - Problem Type: Ambiguous Definition
  - Severity: P3 Low
  - Symptom (what diverges / what is missing): Redundant rule definitions across requirements/flows/technical docs increase drift risk.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/10-product/requirements.md`, `docs/20-architecture/technical_spec.md`, `docs/20-architecture/flows/*.md`, `docs/50-validation/flow_consistency_validation.md`.
  - Clarification Questions (bullet list):
    - Which rule categories must be “define once, reference elsewhere”?
    - Which documents are allowed to restate vs only reference?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `documentation_single_source_reference_policy_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Rule ownership matrix exists by category.
    - Reference-only policy documented for non-canonical docs.
  - Proposed Owner: PM
  - Dependencies (IDs of other CLAR items, if any): CLAR-035

- ID: CLAR-040
  - Domain Area: Governance
  - Problem Type: NFR Quantification
  - Severity: P3 Low
  - Symptom (what diverges / what is missing): Freeze criteria across spec layers are not fully quantified and synchronized.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/00-governance/documentation_governance.md`, `docs/30-analysis/step_08_execution_plan.md`, `docs/30-analysis/step_07_test_strategy.md`.
  - Clarification Questions (bullet list):
    - What measurable criteria freeze each layer (requirements, flows, API, events, KPIs)?
    - Which criteria are mandatory before Sprint execution and release?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): planned artifact `spec_freeze_criteria_v1_EN` (non-local, not yet created).
  - Acceptance Criteria (bullet list; measurable/testable):
    - Freeze checklist per layer with pass/fail fields.
    - Linked to execution go/no-go gates.
  - Proposed Owner: PM
  - Dependencies (IDs of other CLAR items, if any): CLAR-036, CLAR-038

---

- ID: CLAR-TNT-001
  - Domain Area: Tenant
  - Problem Type: Missing Policy
  - Severity: P0 Blocker
  - Status: Resolved
  - Decision: Tenant trusted-signal precedence: Web > API > Backoffice > Telegram. In case of missing trusted signal, apply FAIL-CLOSED by default.
  - Decision Source: CLAR-TNT-001 — 2026-04-28
  - Symptom (what diverges / what is missing): Tenant signal precedence differs by narrative location and is not finalized channel-by-channel.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/40-clarifications/tenant_boundary_policy.md` (Trusted Tenant Signals, resolution table), `docs/40-clarifications/participant_context_resolution_contract.md`, `docs/40-clarifications/spec_inventory_tenant.md` (Current Tenant Model).
  - Clarification Questions (bullet list):
    - What is the final precedence order per channel (Web/API/Telegram/Backoffice) when trusted signals disagree?
    - Is any channel allowed to proceed if one trusted signal is missing but others are present?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): Finalized precedence table in `docs/40-clarifications/tenant_boundary_policy.md`.
  - Acceptance Criteria (bullet list; measurable/testable):
    - One precedence row per channel with conflict outcomes.
    - No unresolved precedence ambiguity for trusted signals.
  - Proposed Owner: Architect
  - Dependencies (IDs of other CLAR items, if any): CLAR-001, CLAR-003

- ID: CLAR-TNT-002
  - Domain Area: Tenant
  - Problem Type: Ambiguous Definition
  - Severity: P0 Blocker
  - Status: Open
  - Symptom (what diverges / what is missing): Identifier scope for `tour_id` and `registration_id` is operationally tenant-bounded but global uniqueness status is not finalized.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/40-clarifications/data_access_tenant_invariants.md` (Identifier Scoping – Current Behavior), `docs/40-clarifications/spec_inventory_tenant.md` (Identifier Scoping as Currently Documented), `docs/20-architecture/contracts/participant_intake_schema.md`.
  - Clarification Questions (bullet list):
    - Are `tour_id` and `registration_id` globally unique in storage semantics?
    - Regardless of storage uniqueness, must tenant predicate remain mandatory for external access?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): Decision note in `docs/40-clarifications/data_access_tenant_invariants.md` under identifier scoping.
  - Acceptance Criteria (bullet list; measurable/testable):
    - Explicit classification for both IDs.
    - Explicit by-id access rule tied to tenant predicate behavior.
  - Proposed Owner: Architect
  - Dependencies (IDs of other CLAR items, if any): CLAR-002

- ID: CLAR-TNT-003
  - Domain Area: Tenant
  - Problem Type: Conflict
  - Severity: P0 Blocker
  - Status: Resolved
  - Decision: Canonical phrase for MVP admin cross-tenant: 'No cross-tenant admin read/write/export on MVP operational surfaces'. Apply this phrase verbatim in all backend docs.
  - Decision Source: CLAR-TNT-003 — 2026-04-28
  - Symptom (what diverges / what is missing): Admin/backoffice behavior is split between "admin global access isolated from tenant surfaces" and MVP single-tenant admin posture.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/20-architecture/technical_spec.md` (Access Control), `docs/40-clarifications/tenant_boundary_policy.md` (Backoffice/Admin MVP Policy), `docs/40-clarifications/spec_inventory_tenant.md` (Admin / Backoffice Cross-Tenant Behavior).
  - Clarification Questions (bullet list):
    - Are any cross-tenant admin operations allowed in MVP?
    - If none are allowed in MVP, which phrase is canonical across all docs?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): Canonical MVP admin scope statement in `docs/40-clarifications/tenant_boundary_policy.md` and aligned wording reference in `docs/20-architecture/technical_spec.md` (future alignment task).
  - Proposed Decision: Canonical phrase for MVP admin cross-tenant: 'No cross-tenant admin read/write/export on MVP operational surfaces'. Apply this phrase verbatim in all backend docs.
  - Acceptance Criteria (bullet list; measurable/testable):
    - Unambiguous MVP statement for admin cross-tenant capability.
    - No conflicting wording across active tenant-facing docs.
  - Proposed Owner: PM
  - Dependencies (IDs of other CLAR items, if any): CLAR-005

- ID: CLAR-TNT-004
  - Domain Area: Tenant
  - Problem Type: Invariant Gap
  - Severity: P1 High
  - Status: Open
  - Symptom (what diverges / what is missing): Query-class-to-tenant-predicate coverage is implied but not fully tied to explicit endpoint/query classes.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/40-clarifications/data_access_tenant_invariants.md` (Query Classes and Tenant Predicates), `docs/30-analysis/step_03_system_requirements.md` (`SR-NFR-001`), `docs/40-clarifications/spec_inventory_tenant.md` (Partial predicate explicitness risk).
  - Clarification Questions (bullet list):
    - Which concrete query classes are mandatory tenant-predicate paths in current behavior?
    - Are there any documented exceptions today?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): Expanded query-class mapping table in `docs/40-clarifications/data_access_tenant_invariants.md`.
  - Acceptance Criteria (bullet list; measurable/testable):
    - By-id, list/search, aggregate, export classes mapped explicitly.
    - Any exception path is documented or explicitly stated as none.
  - Proposed Owner: Tech Lead
  - Dependencies (IDs of other CLAR items, if any): CLAR-002

- ID: CLAR-TNT-005
  - Domain Area: Tenant
  - Problem Type: Traceability Gap
  - Severity: P1 High
  - Status: Open
  - Symptom (what diverges / what is missing): Tenant safety gate references are requirement-level, but stable test IDs for tenant scenarios are not assigned.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/30-analysis/step_07_test_strategy.md` (Gate B), `docs/40-clarifications/tenant_traceability_matrix.md` (OPEN test ID mappings), `docs/40-clarifications/spec_inventory_tenant.md` (Traceability maturity gap).
  - Clarification Questions (bullet list):
    - What stable test IDs represent tenant safety gate scenarios?
    - Which test IDs are strict release blockers?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): Assigned test IDs in `docs/40-clarifications/tenant_traceability_matrix.md`.
  - Acceptance Criteria (bullet list; measurable/testable):
    - Every tenant P0 requirement maps to at least one stable test ID.
    - Release-blocking tenant tests are explicitly marked.
  - Proposed Owner: QA
  - Dependencies (IDs of other CLAR items, if any): CLAR-004

- ID: CLAR-TNT-006
  - Domain Area: Event & KPI
  - Problem Type: Traceability Gap
  - Severity: P1 High
  - Status: Open
  - Symptom (what diverges / what is missing): Tenant KPI/event links are partly conceptual and not fully finalized in naming/ownership.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/40-clarifications/tenant_traceability_matrix.md` (OPEN KPI/Event alignment notes), `docs/30-analysis/step_09_kpi_monitoring.md` (`KPI-10`, boundary events), `docs/40-clarifications/spec_inventory_tenant.md` (Conceptual vs finalized KPI/event links).
  - Clarification Questions (bullet list):
    - Which KPI and event names are final canonical names for tenant boundary monitoring?
    - Which conceptual links remain pending and by when should they be frozen?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): Finalized KPI/event mapping rows in `docs/40-clarifications/tenant_traceability_matrix.md`.
  - Acceptance Criteria (bullet list; measurable/testable):
    - No OPEN naming placeholders for tenant-critical KPI/event links.
    - Canonical names align with KPI/event catalog.
  - Proposed Owner: QA
  - Dependencies (IDs of other CLAR items, if any): CLAR-006, CLAR-028, CLAR-030

- ID: CLAR-TNT-007
  - Domain Area: Governance
  - Problem Type: Ambiguous Definition
  - Severity: P1 High
  - Status: Resolved
  - Symptom (what diverges / what is missing): Archive docs remain discoverable and can be misread as active tenant behavior sources.
  - Evidence (cite the exact file names + section headings or requirement IDs; if multiple docs conflict, list each): `docs/40-clarifications/spec_inventory_tenant.md` (archive artifacts listed as historical), `docs/50-validation/migration_map.md`, `docs/50-validation/archive_traceability.md`.
  - Clarification Questions (bullet list):
    - What is the formal rule for using archive docs in tenant-related decision-making?
    - How should active specs reference archive context without reintroducing legacy assumptions?
  - Expected Output Artifact (what new/updated spec should exist, and where it should live as the canonical source; propose target file name but do not edit it): Governance note in `docs/40-clarifications/clarifications_backlog.md` and cross-reference statement in `docs/40-clarifications/spec_inventory_tenant.md`.
  - Proposed Decision: Archive documents are historical references only and are non-canonical for active product behavior. Active decisions must use current v2/step/spec docs; archive references are allowed only as context with explicit "historical-only" labeling.
  - Acceptance Criteria (bullet list; measurable/testable):
    - Archive treatment rule is explicit (historical vs canonical).
    - Active tenant specs consistently reference this rule.
  - Proposed Owner: PM
  - Dependencies (IDs of other CLAR items, if any): CLAR-035, CLAR-039

---

## Open Issues (Kickoff blockers)

- No open backend kickoff blockers remain for `CLAR-TNT-001`, `CLAR-TNT-003`, `CLAR-017`, `CLAR-027`, `CLAR-029`.
  - Decision Source: CLAR-TNT-001/CLAR-TNT-003/CLAR-017/CLAR-027/CLAR-029 — 2026-04-28

---

## Backend Decision Resolution (Resolved)

- `CLAR-TNT-001`: Tenant trusted-signal precedence: Web > API > Backoffice > Telegram. In case of missing trusted signal, apply FAIL-CLOSED by default.
  - Decision Source: CLAR-TNT-001 — 2026-04-28
- `CLAR-TNT-003`: Canonical phrase for MVP admin cross-tenant: 'No cross-tenant admin read/write/export on MVP operational surfaces'. Apply this phrase verbatim in all backend docs.
  - Decision Source: CLAR-TNT-003 — 2026-04-28
- `CLAR-017`: Payment record is authoritative source-of-truth for read/export operations. Registration is a preliminary source; on mismatch, follow policy: 'Retry (up to 3x) then Reject and create reconciliations task'.
  - Decision Source: CLAR-017 — 2026-04-28
- `CLAR-027`: Audit is MANDATORY for every release-critical transition. Missing audit events SHALL cause PRE-SPRINT-0 gate FAIL.
  - Decision Source: CLAR-027 — 2026-04-28
- `CLAR-029`: All transitions—including non-happy paths—must map to events. Composite transitions MAY map to multiple events if explicitly documented.
  - Decision Source: CLAR-029 — 2026-04-28
- `CLAR-034`: Unknown-field policy: STRICT REJECT across all channels and API versions. Incoming payloads with unknown top-level fields must be rejected; record the rejection in intake logs.
  - Decision Source: CLAR-034 — 2026-04-28

### Decision Resolution Checklist (Backend)

- Decision owner confirms final choice for each item above.
- QA confirms corresponding gate/test expectation update in `docs/30-analysis/step_07_test_strategy.md`.
- Execution dependencies are updated in `docs/30-analysis/step_08_execution_plan.md`.
- KPI trust implications are updated in `docs/30-analysis/step_09_kpi_monitoring.md` for event/payment related decisions.

---

## Changelog

- 2026-04-28: Added backend "Needs Decision" input section for `CLAR-TNT-001` and `CLAR-TNT-003`.
- 2026-04-28: Corrected internal path references for flow and validation document locations after repository refactor.
- 2026-04-28: Expanded backend decision input to include `CLAR-017`, `CLAR-027`, `CLAR-029`, and `CLAR-034` with current context and explicit resolution questions.
- 2026-04-28: Resolved `CLAR-TNT-001` with tenant precedence and fail-closed default. — Decision Source: CLAR-TNT-001 — 2026-04-28
- 2026-04-28: Resolved `CLAR-TNT-003` with canonical admin phrase for MVP backend docs. — Decision Source: CLAR-TNT-003 — 2026-04-28
- 2026-04-28: Resolved `CLAR-017` with payment source-of-truth and mismatch policy. — Decision Source: CLAR-017 — 2026-04-28
- 2026-04-28: Resolved `CLAR-027` with mandatory audit gate-fail rule. — Decision Source: CLAR-027 — 2026-04-28
- 2026-04-28: Resolved `CLAR-029` with non-happy-path and composite transition event mapping rule. — Decision Source: CLAR-029 — 2026-04-28
- 2026-04-28: Resolved `CLAR-034` with strict unknown-field reject policy across channels and versions. — Decision Source: CLAR-034 — 2026-04-28
