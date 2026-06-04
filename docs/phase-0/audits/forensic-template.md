# Phase 0 — Forensic truth

## FORENSIC TRUTH — ENFORCEABLE CONSTRAINTS

```yaml
forensic_truth_rules:
  - id: FT-01
    rule: "Phase 0 gate path INCLUDES seven packages under packages/ plus apps/* in root pnpm build and pnpm test"
    enforcement: REM-013 intentional; scripts/package.json build and test filters
    liability: RF-P0-ABS-01
  - id: FT-02
    rule: "phase-0:gate is trunk integration NOT foundation-only isolation"
    enforcement: package.json phase-0:integration-gate
    liability: RF-P0-GATE-01
  - id: FT-03
    rule: "@casl/ability runtime in workspace-sdk is documented NOT removed"
    enforcement: packages/workspace-sdk peerDependencies @casl/ability
    liability: RF-P0-ABS-02
  - id: FT-04
    rule: "platform-core directory MAY exist during Phase 0; Phase 1 boundary drift documented"
    liability: RF-P0-ABS-03
  - id: FT-05
    rule: "theme-react React runtime layer exists; documented not removed"
    liability: RF-P0-ABS-04
  - id: FT-06
    rule: "ui-primitives react MUST be in dependencies not peer-only in src/"
    enforcement: phase-0-guard g6_runtime_deps_honesty when PHASE_0_GUARD_SCOPE != foundation
    liability: RF-P0-ABS-05 FIXED
  - id: FT-07
    rule: "workspace-starter triple @app-tour/* deps documented"
    liability: RF-P0-ABS-06
  - id: FT-08
    rule: "SDK reference comment couples to starter package documented"
    liability: RF-P0-ABS-07
  - id: FT-09
    rule: "ui-primitives MUST be in IMPORT_BOUNDARY_SCAN_ROOTS"
    enforcement: scripts/guards/foundation-gate-config.mjs IMPORT_BOUNDARY_SCAN_ROOTS
    liability: RF-P0-IMP-01 FIXED
  - id: FT-10
    rule: "workspaces/starter MUST be in IMPORT_BOUNDARY_SCAN_ROOTS"
    liability: RF-P0-IMP-02 FIXED
  - id: FT-11
    rule: "g6 enforces src/ deps honesty for ui-primitives"
    liability: RF-P0-IMP-03 PARTIAL
  - id: FT-12
    rule: "dynamic import() evasion documented; no automated block"
    liability: RF-P0-IMP-04
  - id: FT-13
    rule: "guard script hoisted typescript documented"
    liability: RF-P0-IMP-05
  - id: FT-14
    rule: "no circular-deps depcruise rule out of scope"
    liability: RF-P0-IMP-06
  - id: FT-15
    rule: "createRequire in theme-react scripts documented"
    liability: RF-P0-IMP-07
  - id: FT-16
    rule: "denali in tokens.meta.json forbiddenPatterns excluded from denali scan via *.meta.json exclusion in contract tests"
    liability: RF-P0-IMP-08 FIXED g2 scope
  - id: FT-17
    rule: "phase-0-guard expanded beyond six narrow checks"
    liability: RF-P0-GATE-02 FIXED
  - id: FT-18
    rule: "FOUNDATION_DENALI_DIRS includes design-tokens ui theme workspaces"
    enforcement: foundation-gate-config.mjs FOUNDATION_DENALI_DIRS
    liability: RF-P0-GATE-03 FIXED
  - id: FT-19
    rule: "legacy import grep fragile; replaced by contract tests in foundation gate"
    liability: RF-P0-GATE-04
  - id: FT-20
    rule: "test count floor 103 retired from foundation gate; replaced by invariant manifest contracts"
    liability: RF-P0-GATE-05 FIXED
  - id: FT-21
    rule: "guard:doc-sync MUST run in phase-0:integration-gate"
    enforcement: package.json phase-0:integration-gate DOC_SYNC_SCOPE=foundation
    liability: RF-P0-GATE-09 FIXED
```

---

