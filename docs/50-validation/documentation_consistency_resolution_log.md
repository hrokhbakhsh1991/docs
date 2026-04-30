# Documentation Consistency Resolution Log

> Usage Status: Historical-reference snapshot (non-authoritative for current gate verdict).

## Scope

Source of truth: `docs/50-validation/documentation_consistency_audit.md`

This log records remediation decisions applied across `docs/docs/**/*.md` without introducing new product behavior.

---

## Resolution Entries

### ISSUE-01 — Broken Internal References
- Files changed:
  - `docs/00-governance/readme.md`
  - `docs/10-product/requirements.md`
  - `docs/30-analysis/step_01_business_mission.md`
  - `docs/30-analysis/step_06_implementation_backlog.md`
  - `docs/30-analysis/step_07_test_strategy.md`
  - `docs/40-clarifications/clarifications_backlog.md`
  - `docs/40-clarifications/data_access_tenant_invariants.md`
  - `docs/40-clarifications/participant_context_resolution_contract.md`
  - `docs/40-clarifications/tenant_traceability_matrix.md`
  - `docs/50-validation/archive_traceability.md`
  - `docs/50-validation/migration_map.md`
  - `docs/50-validation/flow_consistency_validation.md`
  - `docs/50-validation/documentation_consistency_audit.md`
- Before/after decision:
  - Before: multiple backticked markdown file references were non-resolvable or malformed.
  - After: all broken backticked/linked markdown references were replaced with valid canonical paths or converted to explicit non-local archive/planned-artifact text.
- Rationale:
  - Remove ambiguity and make references machine-verifiable.
- Residual risk:
  - Non-local archive references remain informational only and are intentionally non-canonical.

### ISSUE-02 — Governance vs Reality Flow Pattern Mismatch
- Files changed:
  - `docs/00-governance/documentation_governance.md`
  - `docs/00-governance/documentation_standard.md`
  - `docs/30-analysis/step_03_system_requirements.md`
  - `docs/30-analysis/step_06_implementation_backlog.md`
  - `docs/30-analysis/step_07_test_strategy.md`
- Before/after decision:
  - Before: policy referenced `flows/*_v2_EN` naming pattern.
  - After: policy aligned to actual canonical path `docs/20-architecture/flows/*.md` (no file rename migration performed).
- Rationale:
  - Keeps folder structure stable and aligns policy with existing canonical flow docs.
- Residual risk:
  - Historical references may still mention legacy naming in narrative context.

### ISSUE-03 — ADR Inconsistency
- Files changed:
  - `docs/00-governance/documentation_governance.md`
  - `docs/20-architecture/decisions.md`
- Before/after decision:
  - Before: governance required ADR structure but `docs/20-architecture/decisions.md` used lightweight `DEC-V2` bullets.
  - After: governance formally defines DEC-V2 as ADR-equivalent schema, and `docs/20-architecture/decisions.md` entries were expanded to include required fields (`Status`, `Context`, `Decision Drivers`, `Decision Outcome`, `Consequences`, `Supersedes/Superseded by`).
- Rationale:
  - Achieves ADR-level rigor while preserving existing DEC-V2 identifier continuity.
- Residual risk:
  - Older historical decisions outside active set may still need migration when imported.

### ISSUE-04 — Requirement ID Policy Inconsistency
- Files changed:
  - `docs/00-governance/documentation_governance.md`
  - `docs/00-governance/documentation_standard.md`
  - `docs/30-analysis/step_03_system_requirements.md`
- Before/after decision:
  - Before: `FR/NFR` and `SR-FR/SR-NFR` coexisted without mandatory lineage policy.
  - After: explicit lineage policy and QA checks were added (bidirectional mapping required).
- Rationale:
  - Enforces deterministic traceability from product requirements to system requirements.
- Residual risk:
  - Existing traceability matrices may still require periodic completeness audits.

### ISSUE-05 — Payment Source-of-Truth Contradiction
- Files changed:
  - `docs/20-architecture/data_model.md`
- Before/after decision:
  - Before: one section declared registration as payment truth; another declared payment record authoritative.
  - After: unified to payment record as authoritative source-of-truth for read/export; registration fields marked preliminary.
- Rationale:
  - Removes direct contradiction and aligns with resolved CLAR policy wording already used in payment flow docs.
- Residual risk:
  - Implementation-level enforcement still depends on backend contract conformance.

### ISSUE-06 — Audit Obligation Strength Conflict
- Files changed:
  - `docs/30-analysis/step_03_system_requirements.md`
- Before/after decision:
  - Before: `SR-NFR-002` used `SHOULD`.
  - After: `SR-NFR-002` upgraded to `MUST` and aligned with mandatory gate language in audit/release docs.
- Rationale:
  - Synchronizes requirement strength with existing release-gate enforcement.
- Residual risk:
  - Test suites must keep full transition coverage to avoid policy drift.

### ISSUE-07 — Archive Policy Mismatch
- Files changed:
  - `docs/00-governance/readme.md`
  - `docs/50-validation/archive_traceability.md`
  - `docs/50-validation/migration_map.md`
  - `docs/50-validation/flow_consistency_validation.md`
- Before/after decision:
  - Before: archive was referenced as local canonical markdown paths.
  - After: archive references were explicitly marked as non-local historical references and non-canonical for active documentation.
- Rationale:
  - Makes repository-local source boundaries explicit and prevents broken canonical assumptions.
- Residual risk:
  - External archive location governance is still operationally out-of-repo.

### ISSUE-08 — RFC2119/8174 Normative Language Consistency
- Files changed:
  - `docs/10-product/requirements.md`
  - `docs/30-analysis/step_03_system_requirements.md`
- Before/after decision:
  - Before: normative statements mixed lowercase modal verbs and inconsistent strength.
  - After: BCP14 boilerplate added to normative sections and normative statements normalized with uppercase RFC2119 keywords.
- Rationale:
  - Aligns normative sections with governance policy and improves interpretive precision.
- Residual risk:
  - Additional standards-like sections in other docs may still need periodic language normalization.
