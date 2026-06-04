# Phase 2 — Architectural integrity & dependency scan (temporary)

| Field | Value |
|-------|--------|
| **Report ID** | `phase-2-temp-architectural-scan-2026-06-04` |
| **Generated (UTC)** | 2026-06-04T03:24:45Z |
| **Git SHA** | `8fcee69` |
| **Scope** | `packages/design-tokens/**`, `packages/ui-primitives/**`, `packages/theme-react/**` (excl. `dist/` unless noted) |
| **Method** | `rg -i` for `denali`, `workspaces/`, `@app-tour/workspaces`; import graph review; `package.json` dependency audit; cross-check vs `dependency-cruiser` rules (`design-tokens-isolated`, `ui-primitives-no-workspaces`, `theme-react-no-workspaces`) |

## Verdict

**0 architectural infiltration violations** in Phase 2 publish packages. **0 reverse couplings** that break Platform Core headless (no Phase 2 package imports `@app-tour/platform-core` or `packages/platform-core/src`).

Allowed imports observed (not violations): `@app-tour/design-tokens`, `@app-tour/workspace-sdk` (+ subpaths `auth`, `auth/casl`), `react` / `react-dom` in ui-primitives and theme-react.

---

## Primary JSON payload

```json
{
  "reportId": "phase-2-temp-architectural-scan-2026-06-04",
  "generatedAt": "2026-06-04T03:24:45Z",
  "gitSha": "8fcee69",
  "scannedPackages": [
    "packages/design-tokens",
    "packages/ui-primitives",
    "packages/theme-react"
  ],
  "category": "Architectural Infiltration",
  "violations": []
}
```

---

## Supplemental — Platform Core headless boundary

Phase 2 packages must not pull engine semantics into the visual layer via `platform-core`, and must not import workspace **product** packages under `packages/workspaces/*`.

```json
{
  "category": "Platform Core Headless Boundary",
  "violations": []
}
```

---

## Supplemental — Informational (non-violations)

These matches are **policy or test fixtures**, not product infiltration:

```json
{
  "category": "Informational — excluded from violations",
  "items": [
    {
      "path": "packages/design-tokens/tokens.meta.json",
      "line": 125,
      "match": "forbiddenPatterns includes \"denali\"",
      "disposition": "Guard metadata — blocks Denali-branded token names in CSS; not an import of Denali product code"
    },
    {
      "path": "packages/theme-react/src/**",
      "match": "getStarterWorkspacePlugin from @app-tour/workspace-sdk",
      "disposition": "SDK reference plugin for tests/harness — not packages/workspaces/starter import (depcruise-allowed)"
    },
    {
      "path": "packages/ui-primitives/.storybook/preview.tsx",
      "match": "@app-tour/workspace-sdk for ThemeProviderChain in Storybook",
      "disposition": "Dev-only harness — not production dependency (ui-primitives runtime deps: design-tokens + react only)"
    }
  ]
}
```

---

## Scan commands (reproducible)

```bash
rg -i 'denali|workspaces/|@app-tour/workspaces' \
  packages/design-tokens packages/ui-primitives packages/theme-react \
  --glob '!dist/**'

rg 'platform-core|PlatformWizardEngine|RuleEngine|render-plan' \
  packages/design-tokens packages/ui-primitives packages/theme-react \
  --glob '!dist/**'

rg 'from ["\x27]@app-tour/(workspaces|platform-core)' \
  packages/design-tokens packages/ui-primitives packages/theme-react \
  --glob '!dist/**'
```

---

## Contractual Drifts

**Scan (UTC):** 2026-06-04 · **Git SHA:** `8fcee69`  
**Law:** contract-first (Markdoc + `package.json` `exports` / `files` + L-01 allowlist + `phase-2.contract.spec.ts`)  
**Packages:** `design-tokens`, `ui-primitives`, `theme-react`, cross-ref `workspace-sdk` theme ingress

### Summary

| Severity | Count | Meaning |
|----------|-------|---------|
| **Violation** (published export breaks policy) | **0** | No barrel on ui-primitives; no `./internal` on theme-react |
| **Doc / JSDoc drift** | **5** | Docs describe APIs or phase timing differently than publish surface / code |
| **Informational** | **4** | Internal `src/` barrels excluded from build; `dist/` dirs visible but not export-mapped |

**Verdict:** Export **policy is enforced** in manifests and guards. Drift is mainly **documentation vs public barrel** (ingress helpers are internal implementation, not package exports).

---

### Export surface matrix (repo truth)

| Package | Published `exports` | Policy | Match? |
|---------|---------------------|--------|--------|
| `ui-primitives` | `./button`, `./input`, `./field-shell`, `./alert`, `./badge` only | Subpath-only (no `.`) | **Yes** — no `dist/index.js` |
| `theme-react` | `"."` only | Single public entry (L-01) | **Yes** — providers only on barrel |
| `design-tokens` | `.`, `./styles.css`, `./semantic`, `./tokens`, `./tokens.meta.json` | Token package may use multi-subpath | **Yes** (separate law from ui-primitives) |

**Public `theme-react` barrel (`src/index.ts` → `dist/index.js`) exports only:**

- `PlatformThemeProvider`, `TenantThemeProvider`, `WorkspaceThemeProvider`, `ThemeProviderChain` (+ prop types)

**Not on public barrel (internal by design):**

- `validateWorkspaceThemeIngress`, `applyWorkspaceThemeUpdate`, `ThemeIngressGuardError`, `useThemeIngressGuard` (`src/ingress/*`)
- Harness: `validatedWorkspaceThemeStyle`, `validatedWorkspacePresetStyle` (`src/harness/*` — excluded from `tsconfig.build.json`)

**Internal source files (not published — not drift violations):**

- `packages/ui-primitives/src/index.ts` — deprecated `export {}`; excluded from `tsconfig.build.json`
- `packages/ui-primitives/src/tokens/index.ts` — re-exports `component-token-maps`; path excluded from build

---

### JSON — Contractual export violations

```json
{
  "category": "Contractual Export Violations",
  "violations": []
}
```

---

### JSON — Documentation & JSDoc drifts

```json
{
  "category": "Contractual Documentation Drift",
  "drifts": [
    {
      "id": "CD-01",
      "severity": "medium",
      "type": "public-surface-vs-docs",
      "docRefs": [
        "docs/phase-2-design-system.mdoc §5.5",
        "packages/workspace-sdk/src/auth/ability.ts L8",
        "docs/MIGRATION-MAP.md (theme handoff chain)"
      ],
      "implementation": "packages/theme-react/src/index.ts exports providers only — NOT validateWorkspaceThemeIngress / useThemeIngressGuard",
      "actualIngressPath": "WorkspaceThemeProvider → useThemeIngressGuard → validateWorkspaceThemeIngress (private to package)",
      "disposition": "Align docs: ingress is runtime-internal; apps must use WorkspaceThemeProvider / ThemeProviderChain, not deep-import ingress helpers"
    },
    {
      "id": "CD-02",
      "severity": "low",
      "type": "phase-label-vs-implementation",
      "docRefs": ["docs/phase-2-design-system.md L731", "docs/phase-2-design-system.mdoc §15.3"],
      "implementation": "WorkspaceThemeProvider already accepts optional `ability` and runs CASL gate before ingress (packages/theme-react/src/providers/WorkspaceThemeProvider.tsx)",
      "docClaim": "Text says CASL gate required in Phase 3.3+",
      "disposition": "Update phase labels to 'implemented in theme-react; Phase 3 wires apps/api ability injection'"
    },
    {
      "id": "CD-03",
      "severity": "low",
      "type": "dependency-graph-wording",
      "docRefs": ["docs/phase-2-design-system.mdoc §9 / depcruise note ~L630"],
      "implementation": "ui-primitives runtime dependencies: design-tokens + react only; theme-react is devDependency for Storybook",
      "disposition": "Clarify 'dev-only harness' vs production depcruise edge"
    },
    {
      "id": "CD-04",
      "severity": "info",
      "type": "doc-structure",
      "docRefs": ["docs/phase-2/subphases/2.2.1-theme-ingress-security.md"],
      "issue": "Duplicate top-level section 'SUBPHASE 2.2.1' (lines 1 and 71)",
      "disposition": "Merge duplicate YAML blocks in Markdoc source"
    },
    {
      "id": "CD-05",
      "severity": "info",
      "type": "filesystem-visible-not-exported",
      "docRefs": ["packages/theme-react/scripts/verify-export-allowlist.mjs DIST_PATH_PREFIXES"],
      "implementation": "Published tarball includes dist/ingress/, dist/tenant/, dist/types/ and ui-primitives dist/utils/ but exports map does not expose subpaths",
      "disposition": "Acceptable under L-01; Node resolution blocks @app-tour/theme-react/ingress. Document as non-API artifacts in security reviews"
    }
  ]
}
```

---

### JSON — Theme ingress: JSDoc vs implementation

```json
{
  "category": "Theme Ingress JSDoc Alignment",
  "findings": [
    {
      "id": "TI-01",
      "status": "aligned",
      "claim": "CASL/authz before ingress",
      "evidence": {
        "jsdoc": "packages/theme-react/src/providers/WorkspaceThemeProvider.tsx — ability optional, 'before ingress'",
        "code": "resolveThemeAccessGate() runs before WorkspaceThemeProviderThemed → useThemeIngressGuard"
      }
    },
    {
      "id": "TI-02",
      "status": "aligned",
      "claim": "Ingress validates via assertWorkspacePlugin + snapshotWorkspaceTheme",
      "evidence": {
        "jsdoc": "packages/theme-react/src/ingress/theme-ingress-guard.ts L28-31",
        "code": "validateWorkspaceThemeIngress calls assertWorkspacePlugin then snapshotWorkspaceTheme",
        "sdk": "packages/workspace-sdk/src/theme/theme-css-value-safety.ts assertThemeCssValueIsSafe (T-6)"
      }
    },
    {
      "id": "TI-03",
      "status": "aligned",
      "claim": "platform-core ignores theme at engine boundary",
      "evidence": {
        "code": "platform-wizard.engine sanitizePluginAtCreate includeTheme:false",
        "guard": "p2_platform_core_no_tokens + phase-1 headless contracts"
      }
    },
    {
      "id": "TI-04",
      "status": "drift",
      "relatedDriftId": "CD-01",
      "claim": "Docs list validateWorkspaceThemeIngress as integrator-facing step",
      "implementation": "Function exists and is tested (theme-ingress-guard.spec.tsx) but is not re-exported from package entry"
    }
  ]
}
```

---

### Guard / contract enforcement (no drift)

| Control | Enforces | Status |
|---------|----------|--------|
| `p2_ui_primitives_no_barrel` | No `.` export, no `dist/index.js` | PASS |
| `p2_theme_react_no_internal_export` | No `./internal` | PASS |
| `p2_theme_react_export_allowlist_l01` | `exports` = `.` only; no `dist/harness/` | PASS |
| `phase-2.contract.spec.ts` | Barrel ban, harness leak, SDK safety path | PASS (10/10) |
| `guard:artifact-surface` | dist ⊆ allowlist | PASS |

---

### Reproducible export audit commands

```bash
# Published export keys
node -e "const p=require('./packages/ui-primitives/package.json'); console.log('ui',Object.keys(p.exports||{}))"
node -e "const p=require('./packages/theme-react/package.json'); console.log('tr',Object.keys(p.exports||{}))"

# Public barrel re-exports
cat packages/theme-react/dist/index.d.ts

# Ingress not on barrel
rg 'validateWorkspaceThemeIngress|useThemeIngressGuard' packages/theme-react/src/index.ts packages/theme-react/dist/index.d.ts

# Deprecated ui-primitives barrel (source only)
cat packages/ui-primitives/src/index.ts
```

---

## CI-Gate Inconsistencies

**Scan (UTC):** 2026-06-04 · **Git SHA:** `8fcee69`  
**Scope:** Root `package.json` scripts, `scripts/ci-integrity-check.sh`, Husky pre-commit, `.github/workflows/phase-2-gate.yml`, `scripts/guards/phase-2-guard.mjs`, `scripts/guards/gate-thresholds.mjs`, cross-check vs closure sign-off §6 and DRIFT-P2 / SB-01–03 fragile controls.

### Verified active (repo truth)

| Surface | Phase 2 linkage | Status |
|---------|-----------------|--------|
| `pnpm run phase-2:gate` | 8 steps: `build` → `test` → `guard:architecture` → `guard:import-boundary` → `validate-design-tokens` → `guard:artifact-surface` → `audit-boundary` → `phase-2:guard` | **Active** |
| `pnpm run phase-2:guard` | Delegates to `scripts/guards/phase-2-guard.mjs` (15 `p2_*` checks) | **Active** |
| `scripts/ci-integrity-check.sh` | After `phase-0:gate` + Phase 1 delta (`guard:symlink`, `phase-1-guard`), runs **`pnpm run phase-2:gate`** | **Active** — DRIFT-P2-11 closed in script |
| `.husky/pre-commit` | `guard-docs.sh` then `pnpm run ci:integrity` | **Active** |
| `.github/workflows/phase-2-gate.yml` | `check-node-engine` + `pnpm run phase-2:gate` + artifact upload `reports/phase-2-gate-*.json` | **Active** |
| `pnpm run phase-3:gate` | Includes full `phase-2:gate` before `doc-gate` | **Active** (regression baseline) |
| `gate-thresholds.mjs` | `WORKSPACE_SDK_TEST_MIN.phase2=50`, `UI_PRIMITIVES_*`, `THEME_REACT_*`, `PHASE_2_BEHAVIOR_CONTRACT_MIN=8` imported by `phase-2-guard.mjs` | **Aligned** — no duplicate `MIN_*` literals in guard |
| Behavioral invariant | `p2_phase2_contract_behaviors` → `test:phase-2` / `phase-2.contract.spec.ts` | **Active** (addresses prior count-only closure gap) |
| SB-01 / SB-02 / SB-03 guards | `p2_theme_react_no_internal_export`, `p2_ui_primitives_no_barrel` + `p2_artifact_surface_guard`, `p2_validate_design_tokens` + `p2_no_denali` | **In gate chain** |

### Inconsistencies, stale references, and residual fragile gaps

| ID | Severity | Finding | vs fragile / audit risk |
|----|----------|---------|-------------------------|
| **CI-01** | **medium** | **Documentation drift:** `docs/phase-2-design-system.ai-exec.md`, `docs/phase-2/phase-2.ai-exec.index.md` (DRIFT-P2-11 *resolution*), `docs/phase-2-design-system.md` / `.mdoc` §11.4, and **`AGENTS.md`** still state or imply `ci:integrity` = `phase-0:gate` + Phase 1 delta only (optional `phase-2:gate`). **Repo script runs full `phase-2:gate`.** | Misleading operators/agents (DRIFT-P2-11); contradicts closure sign-off §6 “CI pre-commit production-ready” |
| **CI-02** | **low** | **Phase 1 vs Phase 2 pre-commit parity:** `ci:integrity` runs **full** `phase-2:gate` but **not** full `phase-1:gate` (no `test:phase-1`, no explicit `phase-1:gate` script—only `guard:symlink` + `phase-1-guard`). | Phase 1 behavioral suite can regress until a dedicated Phase 1 workflow or gate step is run |
| **CI-03** | **low** | **`phase-2:gate` omits top-level `test:phase-2`:** unlike `phase-1:gate`, contract suite is invoked only inside `phase-2-guard` (`p2_phase2_contract_behaviors`). Running **`phase-2:guard` alone** (DRIFT-P2-06) skips depcruise **and** can be mistaken for full closure if dist already exists. | Architecturally fragile: guard-only pass ≠ `phase-2:gate` |
| **CI-04** | **info** | **Intentional omission:** `guard:symlink` in mdoc Appendix G / §11.1 but **not** in `package.json` `phase-2:gate` (symlink still enforced in `ci:integrity` Phase 1 delta). | DRIFT-P2-02 — not a missing guard, doc stale |
| **CI-05** | **info** | **Redundant steps:** `validate-design-tokens`, `guard:artifact-surface`, and `audit-ui-primitives-boundary` run in **`phase-2:gate` steps 5–7** and again inside **`p2_validate_design_tokens`**, **`p2_artifact_surface_guard`**, **`p2_ui_primitives_no_barrel`**. | Cost/duplication only; enforcement not weakened |
| **CI-06** | **medium** | **Count-only floors remain** for `p2_workspace_sdk_tests` (≥50), `p2_ui_primitives_tests` (≥12), `p2_theme_react_tests` (≥4), `p2_visual_regression` (≥4). Stale **133** SDK narrative still in Appendix G tables (`phase-2-design-system.md` / `.mdoc`). | Partially mitigated by `p2_phase2_contract_behaviors`; deleting tests can still satisfy counts if contract rows unchanged |
| **CI-07** | **medium** | **`design-tokens` has no `test` script** — only `p2_design_tokens_dist` + `p2_validate_design_tokens`. No package-level unit tests in root `pnpm test`. | Token regressions rely on validator script, not behavioral specs |
| **CI-08** | **low** | **GitHub workflow vs PR policy:** `phase-2-gate.yml` runs on **all** `push`/`pull_request` to `main`; modular docs cite label `Phase: 2.x` as merge policy—workflow does not filter by label. | Policy/doc mismatch, not absent CI |
| **CI-09** | **low** | **`check-node-engine`** in `ci-integrity-check.sh` and `phase-2-gate.yml`, but **not** embedded in `phase-2:gate` npm script (local `pnpm run phase-2:gate` alone can skip engine check). | Minor local/CI asymmetry |
| **CI-10** | **info** | **Stale Appendix G JSON** in `phase-2-design-system.md` still lists `guard:symlink`-only `phase-2:gate` chain; modular hub `docs/phase-2/phase-2-ci.md` documents repo truth correctly. | DRIFT-P2-01/02/07 — agents must bind to `package.json`, not Appendix G block |

### JSON — CI gate wiring summary

```json
{
  "category": "CI-Gate Parity",
  "gitSha": "8fcee69",
  "phase2GateActive": true,
  "phase2GateInCiIntegrity": true,
  "phase2GateInGithubWorkflow": true,
  "phase2GuardCheckCount": 15,
  "thresholdsSource": "scripts/guards/gate-thresholds.mjs",
  "missingFromRepo": [],
  "staleDocRefs": [
    "AGENTS.md ci:integrity description",
    "docs/phase-2-design-system.ai-exec.md pre_commit_note",
    "docs/phase-2/phase-2.ai-exec.index.md DRIFT-P2-11 resolution",
    "docs/phase-2-design-system.md|.mdoc §11.4 exit criteria",
    "docs/phase-2-design-system.md|.mdoc Appendix G workspace-sdk 133 floor"
  ],
  "residualFragileControls": [
    "count-only p2_* test floors (CI-06)",
    "design-tokens without package tests (CI-07)",
    "phase-2:guard-alone insufficient (CI-03)",
    "phase-1 not full-gated in ci:integrity (CI-02)"
  ]
}
```

### Reproducible verification commands

```bash
# Gate script chain
node -e "console.log(require('./package.json').scripts['phase-2:gate'])"

# Pre-commit / integrity
rg -n 'phase-2:gate' scripts/ci-integrity-check.sh .husky/pre-commit

# Thresholds imported (no stray MIN_ in phase-2-guard)
rg 'from \"./gate-thresholds' scripts/guards/phase-2-guard.mjs
rg 'MIN_WORKSPACE|133' scripts/guards/phase-2-guard.mjs scripts/guards/gate-thresholds.mjs

# CI workflow
cat .github/workflows/phase-2-gate.yml
```

---

---

## Action checklist (remediation tracker)

تمام اصلاحات و اختیاری‌های پیشنهادی در [`phase-2-action-checklist.md`](phase-2-action-checklist.md) — یک‌به‌یک با تیک `[x]` / `[ ]`.

*Temporary audit log — replace or supersede with formal forensic append when Phase 2 closure is re-certified.*
