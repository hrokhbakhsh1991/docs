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
      run: pnpm run doc-gate
      guard_id: p3_doc_gate
      note: "REPO TRUTH — stale md §13.4 JSON block OMITS this step"
    - step: 9
      run: pnpm run phase-3:guard
      expands_to: node scripts/guards/phase-3-guard.mjs
      writes: reports/phase-3-gate-YYYY-MM-DD.json

phase_3_gate_NOT_in_stale_md_13_4:
  - doc-gate
  note: "Execute package.json — not §13.4 stale JSON"

github_workflow:
  file: .github/workflows/phase-3-gate.yml
  trigger: [push main, pull_request]
  node: "24 from .nvmrc"
  command: pnpm run phase-3:gate
  artifact: reports/phase-3-gate-*.json

pre_commit_ci_integrity:
  script: scripts/ci-integrity-check.sh
  runs: [phase-0:gate, phase-1-guard delta]
  does_NOT_run: phase-3:gate
  note: "Appendix G stale claim add phase-3:gate to ci:integrity — NOT implemented"

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
      pnpm run guard:architecture &&
      pnpm run guard:import-boundary &&
      pnpm run guard:artifact-surface &&
      pnpm run audit-boundary &&
      pnpm run phase-2:gate &&
      pnpm run doc-gate &&
      pnpm run phase-3:guard
    doc-gate: node scripts/guards/doc-gate.mjs
    ci_integrity: bash scripts/ci-integrity-check.sh

  stale_md_section_13_4_json:
    claimed_chain: "build + test + guard:architecture + guard:import-boundary + guard:artifact-surface + audit-boundary + phase-2:gate + phase-3:guard"
    missing_in_stale: [doc-gate]
    resolution: "REPO adds doc-gate step 8 before phase-3:guard"

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

