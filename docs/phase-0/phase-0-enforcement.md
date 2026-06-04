# Phase 0 — Enforcement · Forbidden · DoD · Phase 1 entry

## FORBIDDEN ACTIONS (SECTION 11 + GLOBAL)

```yaml
forbidden_actions:
  - action: "implement packages/platform-core feature work as Phase 0 scope"
    correct_phase: "1.x"
  - action: "implement apps/api apps/web as Phase 0 scope"
    correct_phase: "3.x"
  - action: "implement packages/workspaces/denali"
    correct_phase: "6.x"
  - action: "import from legacy/ in new packages"
    correct_phase: never
  - action: "scaffold theme/design-tokens system as Phase 0 deliverable"
    correct_phase: "2.x"
    exception: "SDK theme/auth exports allowed after Phase 2-3 retrofit"
  - action: "modify legacy/ for new features"
    correct_phase: never archive only
  - action: "create delegate-to-legacy adapter"
    rule: L-2
  - action: "design dual-write RHF + canonical state"
    rule: L-8
  - action: "start platform-core before subphase 0.6 PASS"
    rule: DAG forbidden_overlap
  - action: "modify packages/platform-core packages/workspace-sdk apps/api without docs/ Markdoc update first"
    rule: Zero-Debt Covenant .cursorrules
  - action: "bypass Husky pre-commit hooks"
    rule: AGENTS.md
  - action: "workspace-sdk or platform-core import packages/workspaces/*"
    enforcement: depcruise
  - action: "apps/web import workspaces except starter"
    enforcement: depcruise apps-web-no-workspaces-except-starter
```

---

## PHASE 1 ENTRY CHECKLIST (SECTION 12)

```yaml
phase_1_entry_checklist:
  all_must_pass: true
  items:
    - id: P1E-01
      condition: legacy isolated in legacy/
      verify: test -d legacy/apps/api
    - id: P1E-02
      condition: workspace-sdk build + test
      verify: pnpm run test:phase-0 && pnpm --filter @app-tour/workspace-sdk test
    - id: P1E-03
      condition: guard:architecture green
      verify: pnpm run guard:architecture
    - id: P1E-04
      condition: docs MIGRATION-MAP phase-0 phase-1 exist
      verify:
        - test -f docs/MIGRATION-MAP.md
        - test -f docs/phase-0-foundation.mdoc
        - test -f docs/phase-1-platform-core.mdoc
    - id: P1E-05
      condition: CI phase-0-gate green local AND remote after push
      verify: pnpm run phase-0:gate && GitHub workflow both jobs
    - id: P1E-06
      condition: baseline JSON + baseline:metrics PASS
      verify: pnpm run baseline:metrics
    - id: P1E-07
      condition: denali coupling 0 via guard/baseline contracts not raw rg on specs
      verify: baseline t2 PASS
    - id: P1E-08
      condition: no open PR with scope outside Phase 0
      verify: manual gh pr list review
    - id: P1E-09
      condition: guard:doc-sync Phase 0 READMEs + links
      verify: DOC_SYNC_SCOPE=foundation pnpm run guard:doc-sync

on_all_pass:
  next_document: docs/phase-1-platform-core.md
  next_section: "Phase 1.1 scaffold"
```

---

## COMPLETION CHECKLIST (PHASE 0 FULL)

```yaml
phase_0_complete_when_ALL:
  - subphase_0_1: EC-01-2 EC-01-3 PASS; EC-01-1-integration PASS (strict optional / FAIL_BY_DESIGN)
  - subphase_0_2: build test:phase-0 full test PASS
  - subphase_0_3: guard:architecture guard:import-boundary phase-0:gate PASS
  - subphase_0_4: docs + PR template + guard:doc-sync PASS
  - subphase_0_5: workflow exists local gate PASS remote CI PASS
  - subphase_0_6: baseline:metrics PASS artifact exists
  - phase_1_entry_checklist: ALL 9 items PASS
  - zero_debt: no forbidden_actions violated
  - doc_sync: Markdoc canonical phase-0-foundation.mdoc synced if docs touched
```

---


## phase_0_dod_hard / phase_0_dod_soft (§3)

```yaml
phase_0_dod_hard:
  - id: HO-01
    verification: test -d legacy/apps/api && test -f legacy/README.md
    artifact: legacy/
    enforcement_id: P0-E-LEGACY
  - id: HO-02
    verification: pnpm run test:phase-0 exit 0
    artifact: phase-0.contract.spec.ts
    enforcement_id: P0-E-COVENANT
  - id: HO-03
    verification: test -f packages/config/tsconfig.base.json
    enforcement_id: P0-E-CONFIG
  - id: HO-04
    verification: pnpm run guard:architecture exit 0
    enforcement_id: P0-E-ARCH
  - id: HO-05
    verification: pnpm run guard:architecture exit 0
    enforcement_id: P0-E-ARCH
  - id: HO-06
    verification: pnpm run guard:import-boundary exit 0
    enforcement_id: P0-E-IMPORT
  - id: HO-07
    verification: .github/workflows/phase-0-gate.yml has foundation-gate + integration-gate jobs
    enforcement_id: P0-E-CI
  - id: HO-08
    verification: node scripts/guards/phase-0-guard.mjs writes JSON with gitSha
    enforcement_id: P0-E-GUARD-REPORT
  - id: HO-09
    verification: reports/phase-0-gate-*.json or phase-0-foundation-gate-*.json exists after green run
    enforcement_id: P0-E-GUARD-REPORT
  - id: HO-10
    verification: reports/phase-0-baseline-*.json after pnpm run baseline:metrics
    enforcement_id: P0-E-BASELINE
  - id: HO-11
    verification: package.json defines baseline:metrics and phase-0:gate
    enforcement_id: P0-E-CI

phase_0_dod_soft:
  - { id: SO-01, file: docs/MIGRATION-MAP.md, verification: test -f docs/MIGRATION-MAP.md }
  - { id: SO-02, file: docs/phase-0-foundation.mdoc, verification: pnpm run guard:doc-sync }
  - { id: SO-03, file: docs/phase-1-platform-core.mdoc, verification: test -f docs/phase-1-platform-core.mdoc }
  - { id: SO-04, file: .github/pull_request_template.md, verification: test -f .github/pull_request_template.md }

dod_checklist:
  - legacy isolated under legacy/
  - plugin contract registered in workspace-sdk
  - import law enforced in CI
  - no Denali coupling in foundation packages per contract tests
  - Phase 1 MAY start platform-core without coupling risk
```
