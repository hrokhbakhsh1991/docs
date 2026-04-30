# Documentation Consistency Audit Report

> Usage Status: Historical-reference snapshot (non-authoritative after remediation and final re-gate).

## A) Executive Summary

- Audit scope: all Markdown files under `docs/docs/**/*.md` (42 files).
- Result: documentation set is **not implementation-ready** due to multiple governance-critical inconsistencies.
- Critical gaps are concentrated in:
  - internal reference integrity (broken paths),
  - governance-to-reality drift (flow naming pattern, ADR structure),
  - requirement ID normalization drift (`FR/NFR` vs `SR-FR/SR-NFR`),
  - normative language policy non-compliance (RFC2119/8174 policy not consistently applied).
- Additional high-risk contradictions exist in payment source-of-truth statements and tenant/admin scope wording.

---

## B) Critical blockers (must fix before dev)

### Finding C1 — Mandatory flow file pattern mismatch
- Severity: **Critical**
- Source file: `docs/00-governance/documentation_governance.md`
- Conflicting file: `docs/20-architecture/flows/registration.md` (and all flow files in same folder)
- Exact conflicting statements:
  - Governance: `flows/*_v2_EN` naming pattern
  - Reality: existing flow files are `docs/20-architecture/flows/registration.md`, `docs/20-architecture/flows/capacity_management.md`, `docs/20-architecture/flows/waitlist.md`, `docs/20-architecture/flows/cost_and_payment.md`, `docs/20-architecture/flows/telegram_integration.md`
- Recommended canonical resolution:
  - Either rename flow files to `*_v2_EN` naming, or update governance rule to the actual canonical path pattern (`docs/20-architecture/flows/*.md`) with explicit migration note.

### Finding C2 — ADR/MADR governance requirement not implemented
- Severity: **Critical**
- Source file: `docs/00-governance/documentation_governance.md`
- Conflicting file: `docs/20-architecture/decisions.md`
- Exact conflicting statements:
  - Governance: `All significant architecture/product decisions MUST be documented as ADR entries.` and ADR structure with `Title (ADR-XXXX)`, `Status`, `Context`, `Decision Drivers`, `Options`, `Decision Outcome`, `Consequences`.
  - Decisions reality: entries are `DEC-V2-001...DEC-V2-009` with only `Decision:` bullets and no ADR/MADR sections.
- Recommended canonical resolution:
  - Convert decision log into ADR-compliant records (single decision per entry) or formally define `DEC-V2` as an approved ADR-lite format in governance with mandatory equivalent fields.

### Finding C3 — Internal path reference integrity failure (high volume)
- Severity: **Critical**
- Source file: multiple (highest concentration: `docs/00-governance/readme.md`)
- Conflicting file: repository reality (missing targets)
- Exact conflicting statements:
  - Examples: archive-style non-local references, malformed `flows/docs/20-architecture/flows/registration` path form, `docs/50-validation/leader_app_delta_analysis.md` (previously unqualified), `docs/50-validation/flow_consistency_validation.md` (previously unqualified), plus many draft artifact references in clarifications.
  - Audit result: 11 files contained genuine missing markdown references; top offenders included:
    - `docs/00-governance/readme.md` (44 missing references),
    - `docs/40-clarifications/clarifications_backlog.md` (34),
    - `docs/50-validation/archive_traceability.md` (20),
    - `docs/50-validation/migration_map.md` (15).
- Recommended canonical resolution:
  - Enforce repo-root-qualified paths (`docs/...`) for all internal references.
  - Replace placeholder paths with explicit `TBD artifact` markers (non-link text) until files exist.
  - Add CI lint rule for broken markdown links and backticked markdown paths.

### Finding C4 — Payment source-of-truth contradiction in canonical architecture
- Severity: **Critical**
- Source file: `docs/20-architecture/data_model.md`
- Conflicting file: `docs/20-architecture/flows/cost_and_payment.md` (same policy family) and internal contradiction in same file
- Exact conflicting statements:
  - `docs/20-architecture/data_model.md` section 4.7: `in MVP, payment truth remains Registration.payment_status`
  - `docs/20-architecture/data_model.md` section 5: `Payment record is authoritative source-of-truth for read/export operations. Registration is a preliminary source...`
  - `docs/20-architecture/flows/cost_and_payment.md`: `Payment record is authoritative source-of-truth for read/export operations. Registration is a preliminary source...`
- Recommended canonical resolution:
  - Keep one canonical SoT statement (prefer latest resolved CLAR-017 text), remove contradictory legacy line, and propagate to all dependent docs.

---

## C) Major inconsistencies

### Finding M1 — Requirement ID scheme drift (FR/NFR vs SR-FR/SR-NFR) without canonical mapping policy
- Severity: **Major**
- Source file: `docs/00-governance/documentation_standard.md`
- Conflicting file: `docs/30-analysis/step_03_system_requirements.md`
- Exact conflicting statements:
  - Standard: `Requirement IDs: FR-XX, NFR-XX`
  - Step 03 baseline: `SR-FR-001...SR-FR-010` and `SR-NFR-001...SR-NFR-004`
- Recommended canonical resolution:
  - Define and publish mandatory mapping policy: `FR/NFR` (product baseline) -> `SR-FR/SR-NFR` (system baseline), including one-to-many rules and traceability table requirements.

### Finding M2 — Missing explicit FR/NFR -> SR mapping rule
- Severity: **Major**
- Source file: `docs/10-product/requirements.md`
- Conflicting file: `docs/30-analysis/step_03_system_requirements.md`
- Exact conflicting statements:
  - Product requirements define `FR-*` and `NFR-*`.
  - Step 03 defines `SR-*` set but no formal canonical section declaring mapping constraints from product IDs to SR IDs.
- Recommended canonical resolution:
  - Add a required “ID lineage” section in Step 03 (or governance) with deterministic mapping rule and completeness checks.

### Finding M3 — Normative language policy not consistently applied
- Severity: **Major**
- Source file: `docs/00-governance/documentation_governance.md`
- Conflicting file: multiple standards-like docs (example: `docs/10-product/requirements.md`)
- Exact conflicting statements:
  - Governance policy: uppercase RFC2119 keywords required in standards-like sections + mandatory BCP14 boilerplate.
  - Example non-compliant lines in requirements: `The system must provide...`, `must support...`, `should provide...` (lowercase).
- Recommended canonical resolution:
  - Classify which sections are normative; enforce uppercase BCP14 terms in those sections and include boilerplate once per document.

### Finding M4 — Audit obligation level conflict (`SHOULD` vs mandatory gate fail)
- Severity: **Major**
- Source file: `docs/30-analysis/step_03_system_requirements.md`
- Conflicting file: `docs/20-architecture/contracts/audit_event_schema.md`
- Exact conflicting statements:
  - Step 03: `SR-NFR-002 Critical status transitions SHOULD be audit-logged...`
  - Audit contract: `Audit is MANDATORY... Missing audit events SHALL cause PRE-SPRINT-0 gate FAIL.`
- Recommended canonical resolution:
  - Upgrade `SR-NFR-002` from `SHOULD` to `MUST` (or downgrade contract and gate text), then synchronize Step 07/08/09 references.

### Finding M5 — Archive reference policy and reality mismatch
- Severity: **Major**
- Source file: `docs/00-governance/readme.md`
- Conflicting file: repository reality (`docs/_archive/marketplace_v1` not present under audited tree)
- Exact conflicting statements:
  - Readme repeatedly references `docs/_archive/marketplace_v1/...` files as active source anchors.
  - No `_archive` markdown files exist under `docs/docs`.
- Recommended canonical resolution:
  - Clarify archive location policy (inside repo, external repo, or removed), then either restore referenced files, update paths, or mark as historical-not-local references.

### Finding M6 — QA “Pass” claims conflict with actual broken references
- Severity: **Major**
- Source file: `docs/50-validation/archive_traceability.md`
- Conflicting file: same repository state
- Exact conflicting statements:
  - QA checklist claims: `English-only active v2 docs: Pass`, `Flow/requirements/data-model consistency: Pass`.
  - Same file contains multiple broken references (`flows/docs/...`, bare archive file names).
- Recommended canonical resolution:
  - Replace static `Pass` labels with evidence-backed checks and timestamped validation criteria.

---

## D) Minor inconsistencies

### Finding m1 — Tenant/admin scope wording ambiguity
- Severity: **Minor**
- Source file: `docs/20-architecture/technical_spec.md`
- Conflicting file: `docs/20-architecture/decisions.md`, `docs/40-clarifications/spec_inventory_tenant.md`
- Exact conflicting statements:
  - Technical spec: `Admin-level global access is isolated from tenant-facing surfaces.`
  - Decisions (`DEC-V2-009`): `Cross-tenant admin read/write/export is not permitted in MVP operational endpoints.`
  - Inventory notes admin cross-tenant behavior as “documented possibility”.
- Recommended canonical resolution:
  - Publish one canonical MVP admin-scope sentence and reuse verbatim in all docs.

### Finding m2 — “Connect Telegram” modality strength drift (`must` vs `should`)
- Severity: **Minor**
- Source file: `docs/10-product/requirements.md`
- Conflicting file: `docs/20-architecture/flows/telegram_integration.md`
- Exact conflicting statements:
  - Requirements: `Web users must be offered a visible Connect Telegram action...`
  - Telegram flow: `user should be offered Connect Telegram after onboarding`
- Recommended canonical resolution:
  - Align on one normative level (`MUST` preferred for requirement consistency).

### Finding m3 — Placeholder artifact links in clarification backlog are unresolved but rendered as links
- Severity: **Minor**
- Source file: `docs/40-clarifications/clarifications_backlog.md`
- Conflicting file: missing target artifacts
- Exact conflicting statements:
  - Dozens of references such as planned artifacts `registration_state_machine_contract_v1_EN`, `payment_state_machine_contract_v1_EN`, `adr_packaging_policy_v1_EN` were unresolved placeholders.
- Recommended canonical resolution:
  - Convert unresolved placeholders into a structured “Planned Artifacts” list (non-link text) until created.

---

## E) File-by-file findings

- `docs/00-governance/documentation_governance.md`
  - Critical: mandatory flow pattern `flows/*_v2_EN` does not match actual flow files.
  - Critical: ADR/MADR mandatory structure not reflected in `docs/20-architecture/decisions.md`.

- `docs/00-governance/documentation_standard.md`
  - Major: requirement ID standard (`FR/NFR`) conflicts with Step-03 `SR-*` scheme without mapping policy.

- `docs/00-governance/readme.md`
  - Critical: highest volume broken references (archive, relative legacy names, malformed `flows/docs/...` paths).
  - Major: archive source policy points to non-existing local paths.

- `docs/10-product/requirements.md`
  - Major: normative wording mostly lowercase `must/should`.
  - Minor: unresolved relative reference to `leader_app_delta_analysis.md`.

- `docs/20-architecture/data_model.md`
  - Critical: contradictory payment source-of-truth lines (Registration vs Payment).

- `docs/20-architecture/technical_spec.md`
  - Minor: admin scope wording can be interpreted as broader than `DEC-V2-009`.

- `docs/20-architecture/decisions.md`
  - Critical: decision format is `DEC-*` list, not ADR/MADR required structure.

- `docs/30-analysis/step_03_system_requirements.md`
  - Major: `SR-NFR-002` uses `SHOULD`, conflicting with mandatory audit gate in contracts/execution docs.
  - Major: references flow naming wildcard that does not match real path pattern.

- `docs/30-analysis/step_06_implementation_backlog.md`
  - Major: broken `flows/docs/...` references.

- `docs/30-analysis/step_07_test_strategy.md`
  - Major: mixed references to non-existent wildcard/form (`flows/*_v2_EN`, `analysis_step_04_*_v1_EN`), reducing traceability precision.

- `docs/40-clarifications/clarifications_backlog.md`
  - Minor (content quality) / Major (traceability): large set of unresolved artifact links.

- `docs/50-validation/archive_traceability.md`
  - Major: broken references and false-positive “Pass” quality claims.

- `docs/50-validation/migration_map.md`
  - Major: references archive paths that are not locally resolvable.

- `docs/50-validation/flow_consistency_validation.md`
  - Major: references to archive flow paths not present in current audited tree.

---

## F) Proposed canonical resolution policy

1. **Path Canonicalization Policy**
   - All internal doc references MUST be repo-root-qualified (`docs/...`) and resolvable in-repo.
   - Placeholders MUST be non-link text until file creation.

2. **ID Lineage Policy**
   - Product requirements keep `FR-*`/`NFR-*`.
   - System requirements use `SR-FR-*`/`SR-NFR-*`.
   - Mandatory lineage matrix: every `FR/NFR` maps to at least one `SR-*` and every `SR-*` maps back.

3. **Decision Record Policy**
   - Adopt full ADR structure for all `DEC-V2-*` items, or formally publish an approved ADR-lite schema and migrate existing decisions.

4. **Normative Language Policy Enforcement**
   - Standards-like sections must include BCP14 boilerplate and uppercase RFC2119 terms only.
   - Lowercase `must/should/may` prohibited in normative requirements sections.

5. **Single Source-of-Truth Policy for critical invariants**
   - Payment SoT, audit obligations, tenant/admin scope each defined once (canonical authority file + explicit “derived copies” rule).

6. **Validation Gate Policy**
   - Quality claims (`Pass`) only allowed when generated from reproducible checks (link check, ID mapping check, terminology check).

---

## G) Prioritized fix plan (P0/P1/P2)

### P0 (Immediate blockers)
1. Resolve flow naming/path governance mismatch (`flows/*_v2_EN` vs actual files).
2. Fix broken internal references in governance/validation core docs.
3. Resolve payment SoT contradiction in `docs/20-architecture/data_model.md` and dependent files.
4. Align audit obligation strength (`SR-NFR-002`) with mandatory gate policy.
5. Define archive location policy and update invalid archive links.

### P1 (High-value consistency hardening)
1. Introduce formal FR/NFR <-> SR mapping policy + matrix.
2. Migrate `docs/20-architecture/decisions.md` to ADR-compliant structure.
3. Normalize RFC2119 usage in normative sections.
4. Standardize admin scope wording across architecture/clarification docs.

### P2 (Sustainability / anti-drift)
1. Add automated markdown reference validator in CI.
2. Add doc-lint rules for naming pattern, ID scheme, and normative keyword policy.
3. Convert “Pass” checklist assertions to generated validation artifacts.
4. Add a monthly documentation consistency regression check.

