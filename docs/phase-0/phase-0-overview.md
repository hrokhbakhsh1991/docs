# Phase 0 — Overview & phase detection

## STEP 1 — PHASE DETECTION (COMPLETE)

```yaml
phase_id: "0"
phase_name: "Foundation & Contract (workspace-sdk)"
north_star: "Platform logic = generic · Workspace logic = injectable"
document_status_claim: "Foundation Integration Phase — phase-0:gate green; apps/* at root per REM-013"
document_closure_claim: "Phase 0 complete (covenant + integration gate + baseline); next = Phase 1.1"
prerequisite_phase: none
prerequisite_gate: none
subphases:
  - id: "0.1"
    name: "Legacy archive + Integration Foundation root layout"
    pr_label: "Phase: 0.1"
    depends_on: []
  - id: "0.2"
    name: "@app-tour/workspace-sdk + starter reference plugin"
    pr_label: "Phase: 0.2"
    depends_on: ["0.1"]
  - id: "0.3"
    name: "Architecture guard (dependency-cruiser + import-boundary)"
    pr_label: "Phase: 0.3"
    depends_on: ["0.2"]
  - id: "0.4"
    name: "Documentation and social contract"
    pr_label: "Phase: 0.4"
    depends_on: ["0.1"]
  - id: "0.5"
    name: "CI gate Phase 0"
    pr_label: "Phase: 0.5"
    depends_on: ["0.2", "0.3"]
  - id: "0.6"
    name: "Baseline metrics (lightweight coupling)"
    pr_label: "Phase: 0.6"
    depends_on: ["0.5"]
phase_detection_blocker: null
```

---

## SECTION 1 — GREENFIELD CONTEXT (CONSTRAINTS ONLY)

```yaml
constraints:
  - id: C1-legacy-meaning
    legacy_project: "Phase 0 = freeze on Denali-locked monolith"
    legacy_actions_forbidden_in_app_tour:
      - "stop structural refactor on Denali-locked code at root"
      - "register denali_token_count baseline per layer as Phase 0 goal"
      - "freeze seven TourFormProfile"
      - "keep legacy wizard smoke green as Phase 0 exit"
  - id: C1-app-tour-meaning
    app_tour_phase_0_MEANS:
      - action: "physically isolate old monorepo under legacy/"
      - action: "establish plugin language @app-tour/workspace-sdk without Denali/old types"
      - action: "enforce import law from day 1 via dependency-cruiser blocking"
      - action: "maintain starter reference plugin minimal production-shaped NOT unrelated mock"
      - action: "publish migration map + this doc BEFORE platform-core implementation"
```

---

## SECTION 2 — NEGATIVE REQUIREMENTS (LEGACY LESSONS L-1..L-10)

```yaml
hard_rules_legacy_lessons:
  - id: L-1
    forbidden: "claim Phase 1 complete while bridge only general and all delegate to legacy"
    required: "Phase 0 is contract only; production behavior belongs Phase 3+"
  - id: L-2
    forbidden: "SdkWorkspaceStrategyAdapter pattern where all methods delegate legacy.getX()"
    required: "plugin implementation OR nothing; NO delegate-to-legacy adapter"
  - id: L-3
    forbidden: "mockWorkspacePlugin with 2 fake fields"
    required: "starterWorkspacePlugin with real registry/rules/wizard shape"
  - id: L-4
    forbidden: "SDK dependency on @repo/types or TourFormProfile"
    required: "WorkspaceTypeId defined inside SDK"
  - id: L-5
    forbidden: "fast-forward 4 sub-phases in one merge"
    required: "exactly one subphase per PR with Phase: 0.x label"
  - id: L-6
    forbidden: "local ci:integrity green while GitHub main red"
    required: "phase-0-gate workflow runs on push to main AND pull_request"
  - id: L-7
    forbidden: "skip platform-core; build wizard directly on Denali"
    required: "Phase 1 app-tour builds platform-core BEFORE apps"
  - id: L-8
    forbidden: "dual state RHF + canonical + sync"
    required: "from Phase 3 UI canonical is sole SoT; record in Phase 0 contract"
  - id: L-9
    forbidden: "DENALI_STRATEGY_PROFILES hardcoded in API core"
    required: "only WorkspaceTypeBinding in SDK; constants live in plugin"
  - id: L-10
    forbidden: "stale baseline JSON after merge"
    required: "gate reports JSON MUST include gitSha on every run"
```

---

## SECTION 3 — PHASE 0 OUTPUT DEFINITION

### 3.1 Hard outputs (code + CI)

```yaml
hard_outputs:
  - id: HO-01
    artifact: legacy/
    requirement: "contains full previous monorepo + legacy/README.md"
    verify: "test -d legacy/apps/api && test -f legacy/README.md"
  - id: HO-02
    artifact: "@app-tour/workspace-sdk"
    requirement: "build PASS; foundation closure via test:phase-0 NOT raw count ≥103 alone"
    verify: "pnpm run test:phase-0 exit 0"
    doc_claim_retired: "≥103 unit tests (90% of 114) — H-03 retired"
    repo_truth: "165 tests / 35 suites informational; phase-0.contract.spec.ts 10 covenant contracts; count floor retired from foundation gate"
  - id: HO-03
    artifact: "@app-tour/config"
    requirement: "shared tsconfig.base.json"
    verify: "test -f packages/config/tsconfig.base.json"
  - id: HO-04
    artifact: dependency-cruiser.config.js
    requirement: "blocking forbidden rules present"
    verify: "pnpm run guard:architecture exit 0"
  - id: HO-05
    command: pnpm run guard:architecture
    requirement: "exit 0"
  - id: HO-06
    command: pnpm run guard:import-boundary
    requirement: "AST barrel / forbidden paths parity with CI"
  - id: HO-07
    artifact: .github/workflows/phase-0-gate.yml
    requirement: "foundation-gate job + integration-gate job on push main and pull_request"
  - id: HO-08
    artifact: scripts/guards/phase-0-guard.mjs
    requirement: "writes JSON report with gitSha"
  - id: HO-09
    artifact: "reports/phase-0-gate-*.json OR reports/phase-0-foundation-gate-*.json"
    requirement: "latest green run exists"
  - id: HO-10
    artifact: reports/phase-0-baseline-*.json
    requirement: "baseline coupling report exists"
  - id: HO-11
    commands: ["pnpm run baseline:metrics", "pnpm run phase-0:gate"]
    requirement: "both defined in package.json"
```

### 3.2 Soft outputs (documentation)

```yaml
soft_outputs:
  - { file: docs/MIGRATION-MAP.md, role: "7-phase map" }
  - { file: docs/phase-0-foundation.md, role: "this doc mirror" }
  - { file: docs/phase-0-foundation.mdoc, role: "Markdoc canonical" }
  - { file: docs/phase-1-platform-core.md, role: "Phase 1 execution" }
  - { file: .github/pull_request_template.md, role: "Phase: N.M field" }
```

### 3.3 Definition of Done (single sentence → checklist)

```yaml
dod_checklist:
  - "legacy isolated under legacy/"
  - "plugin contract registered in workspace-sdk"
  - "import law enforced in CI"
  - "no Denali coupling in foundation packages per contract tests"
  - "Phase 1 MAY start platform-core without coupling risk"
```

---

