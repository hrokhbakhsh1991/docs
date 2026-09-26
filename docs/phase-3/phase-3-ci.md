# Phase 3 — CI / phase-3:gate

## CI PIPELINE — phase-3:gate CANONICAL CHAIN (package.json REPO TRUTH)

```yaml
phase_3_gate:
  name: pnpm run phase-3:gate
  source: package.json scripts.phase-3:gate
  steps_ordered:
    - step: 1
      run: pnpm build
      includes: [design-tokens, ui-primitives, theme-react, platform-core, workspace-sdk, starter, apps]
      postbuild: guard:artifact-surface on publishable packages via postbuild hooks
    - step: 2
      run: pnpm test
      includes: monorepo package tests
    - step: 3
      run: pnpm run guard:architecture
      validates: [depcruise rules P3-E-WS-01, P3-E-API-01, no-legacy-imports, ...]
    - step: 4
      run: pnpm run guard:import-boundary
      validates: "AST barrel ban P3-E-BARREL"
    - step: 5
      run: pnpm run guard:artifact-surface
      guard_id: p3_artifact_surface
      remediation: SB-02
    - step: 6
      run: pnpm run audit-boundary
      script: scripts/guards/audit-ui-primitives-boundary.mjs
    - step: 7
      run: pnpm run phase-2:gate
      note: "frozen baseline — phase 3 must not regress phase 2"
      includes: [validate-design-tokens, phase-2:guard, ...]
    - step: 8
      run: pnpm run phase-3:guard
      expands_to: node scripts/guards/phase-3-guard.mjs
      owns: [p3_doc_gate]
    - step: 9
      run: node scripts/guards/write-phase-3-gate-report.mjs
      condition: "PHASE_3_GATE_CHAIN_REACHED=1 after steps 1-8 succeed"
      owns: [phase_3_gate_report]
      writes: reports/phase-3-gate-YYYY-MM-DD.json

phase_3_gate_doc_contract:
  owner: phase-3-guard
  rule: "doc-gate runs once as p3_doc_gate inside phase-3:guard; package.json must not add a second invocation"

phase_3_gate_report_contract:
  owner: phase-3:gate post-step
  rule: "the aggregate report is written only after the canonical chain succeeds; guard and apps-cert reports remain check-level evidence"

github_workflow:
  file: .github/workflows/phase-3-gate.yml
  trigger: [push main, pull_request]
  node: "24 from .nvmrc"
  command: pnpm run phase-3:gate
  artifact: reports/phase-3-gate-*.json

pre_commit_ci_integrity:
  script: scripts/ci-integrity-check.sh
  runs: [phase-0:gate, phase-1:gate, phase-2:gate, phase-3:gate]
  note: "Full chain 0→1→2→3 on every commit (P0-01 closed 2026-06-04)"

pr_policy:
  title_body_label: "Phase: 3.x"
  one_subphase_per_pr: true
  docs_before_3_1_code: doc-gate + docs/ Markdoc update
  merge_blocked_when:
    - phase-3-guard required check false
    - any P3 invariant violated
    - barrel import in apps/**
```

---

## APPENDIX G — phase-3:gate REPO vs STALE DOC (§18.G)

```yaml
appendix_G_repo_truth:
  package_json_scripts:
    phase-3:guard: node scripts/guards/phase-3-guard.mjs
    phase-3:gate: |
      pnpm build &&
      pnpm test &&
      pnpm --filter @app-tour/platform-core run test:phase-2 &&
      pnpm run phase-2:guard &&
      pnpm run phase-3:guard &&
      pnpm run phase-3:apps-cert &&
      PHASE_3_GATE_CHAIN_REACHED=1 node scripts/guards/write-phase-3-gate-report.mjs
    doc-gate: node scripts/guards/doc-gate.mjs
    ci_integrity: bash scripts/ci-integrity-check.sh

  stale_md_section_13_4_json:
    claimed_chain: "build + test + guard:architecture + guard:import-boundary + guard:artifact-surface + audit-boundary + phase-2:gate + phase-3:guard"
    missing_in_stale: [guard:architecture, guard:import-boundary, guard:artifact-surface, audit-boundary]
    resolution: "doc-gate is intentionally owned by phase-3:guard as p3_doc_gate; the outer chain does not duplicate it"

  stale_md_section_13_5_table:
    claimed_checks: "numbered 1-9 without p3_* ids; lint-only; missing doc-gate api-gate web-gate"
    repo_checks: "p3_doc_gate through p3_no_denali — see GUARDS section"
    resolution: "Bind agents to phase-3-guard.mjs ids not §13.5 narrative table"

  stale_appendix_G_ci_integrity:
    claimed: "add phase-3:gate to ci:integrity after DoD"
    repo: "ci-integrity-check.sh runs phase-0:gate + phase-1-guard ONLY"
    resolution: "Phase 3 merge gate = GitHub workflow phase-3-gate.yml — NOT Husky pre-commit"

  github_workflow:
    file: .github/workflows/phase-3-gate.yml
    command: pnpm run phase-3:gate
    artifact_upload: reports/phase-3-gate-*.json

  report_output:
    path: reports/phase-3-gate-YYYY-MM-DD.json
    fields: [generatedAt, gitSha, phase, reportDate, enforcement, checks, exit]
    phase_field_value: "3.5"
```

---
