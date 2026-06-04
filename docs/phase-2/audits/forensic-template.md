# Phase 2 — Forensic Truth (§13 audit)

## FORENSIC TRUTH — §13 AUDIT SB-01 / SB-02 / SB-03

```yaml
forensic_truth_rules:
  - id: FT-P2-SB-01
    claim: "theme-react ./internal exported unvalidated DOM mappers — docs claimed Safety Seal"
    severity: CRITICAL
    remediation: "Removed ./internal export; deleted src/internal.ts"
    enforcement: p2_theme_react_no_internal_export
    guard_ids: [p2_theme_react_no_internal_export]
    status: REMEDIATED
  - id: FT-P2-SB-02
    claim: "dist/** deep-import surface — private meant not on index only"
    severity: HIGH
    remediation: "L-01 exports = . only; files whitelist; verify:exports; guard:artifact-surface in phase-2:gate"
    enforcement: [p2_artifact_surface_guard, p2_theme_react_export_allowlist_l01]
    guard_ids: [p2_artifact_surface_guard, p2_theme_react_export_allowlist_l01]
    status: REMEDIATED
    note: "ui-primitives uses subpath exports only — no barrel dist/index.js"
  - id: FT-P2-SB-03
    claim: "Harness helpers on production theme-react . export"
    severity: HIGH
    remediation: "Stripped harness from index.ts; harness not in exports"
    enforcement: p2_theme_react_export_allowlist_l01
    guard_ids: [p2_theme_react_export_allowlist_l01]
    status: REMEDIATED
  - id: FT-P2-01
    claim: "Phase 2 Security Seal = Satisfied via restricted subpath exports — not Fully satisfied until SB remediated"
    repo: "MAP Security & Compliance + audit history §13.2"
    enforcement: "all p2_* PASS + zero barrel violations"
  - id: FT-P2-02
    claim: "platform-core never reads theme CSS"
    repo: "parseWorkspacePluginFromStorage includeTheme:false at engine boundary"
    enforcement: p2_platform_core_no_tokens + phase-1 headless contracts
    guard_ids: [p2_platform_core_no_tokens]
  - id: FT-P2-03
    claim: "CASL before theme ingress at runtime (phase 3+)"
    repo: "phase 2 proves CSS safety; phase 3 proves actor authorization"
    enforcement: "providers.spec.tsx deny → ingress not called"
    status: PHASE_3_REQUIRED
  - id: FT-P2-04
    claim: "Select + Checkbox Complete in phase 2"
    repo: "BACKLOG — phase 3 — NOT gate blockers per §13.1"
    status: BACKLOG_NOT_COMPLETE
  - id: FT-P2-05
    claim: "workspace-sdk test floor 133 in stale Appendix G table"
    repo: "gate-thresholds.mjs WORKSPACE_SDK_TEST_MIN.phase2 = 50"
    enforcement: p2_workspace_sdk_tests
    resolution: REPO threshold 50 — not 133
  - id: FT-P2-06
    claim: "rgba in --shadow-* in primitives.css fails gate"
    repo: "P2-006 accepted backlog — token definition layer only"
    status: BACKLOG_ACCEPTED
```
