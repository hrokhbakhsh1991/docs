# Zero-Debt Remediation Audit (Phases 0–3)

**Generated:** 2026-06-03  
**Status:** **Closed — Zero-Debt Verified**  
**Supersedes:** `audit-temp-phase-0.md`, `audit-temp-phase-1.md`, `audit-temp-phase-2.md`, `audit-temp-phase-3.md` (removed after Waves A–E)

---

## Executive sign-off

After five remediation waves (A–E), the platform scaffold for **Phases 0–3** meets documented exit criteria with **enforced** gate thresholds (parsed test counts, not exit-code-only shortcuts).

| Gate | Result | Evidence |
|------|--------|----------|
| `pnpm run phase-0:gate` | PASS | `reports/phase-0-gate-2026-06-03.json` — g5 **114** tests (floor **≥ 13**) |
| `pnpm run phase-1:gate` | PASS | `reports/phase-1-guard-2026-06-03.json` |
| `pnpm run phase-2:gate` | PASS | Included in `phase-3:gate` chain |
| `pnpm run phase-3:gate` | **PASS 100%** | **16/16** required checks — `reports/phase-3-gate-2026-06-03.json` |

**Final verification (2026-06-03):** `pnpm run phase-3:gate` exit **0** (~5 min, Node 24).

**Soft backlog (non-blocking):** Playwright E2E (optional), Select/Checkbox primitives (Phase 3.3.x), remote GitHub Actions checkbox (§9.4 L-6).

---

## Wave remediation summary

| Wave | REM scope | Outcome |
|------|-----------|---------|
| **A** | REM-001, 003, 006, 007, 021 | CI `phase-0:gate` parity, Node 24, `postbuild` → `guard:artifact-surface`, import-boundary in workflow |
| **B** | REM-002, 005, 008, 023 | Tenant kernel — no fabricated headers; API/web fail-closed |
| **C** | REM-004, 009–011, 015–016 | Phase 0/1 doc sync (CASL, depcruise 21 rules, dual starter, facade API, `HIDDEN_FIELD_POISON`) |
| **D** | REM-014, 018–022, 035, 037 | Starter plugin single source; dist emit hygiene; theme-react export surface |
| **E** | REM-013, 017, 025, 026 | Gate thresholds centralized; `checkWorkspaceSdkTests` enforces **≥ 13** parsed count |

Reports: [`reports/wave-a-status-report-2026-06-02.md`](../../reports/wave-a-status-report-2026-06-02.md) through [`reports/wave-e-status-report-2026-06-03.md`](../../reports/wave-e-status-report-2026-06-03.md).

---

## Wave E — Gate threshold enforcement (REM-013, 017, 025, 026)

### REM-026 — `checkWorkspaceSdkTests` exit-code-only shortcut

**Before:** `phase-0-guard.mjs` g5 claimed “≥ 7 cases” but only checked `pnpm test` exit code.

**After:**

- Shared parser: [`scripts/guards/lib/parse-test-output.mjs`](../../scripts/guards/lib/parse-test-output.mjs) (`# tests` / `ℹ tests`).
- Floor **≥ 13** aligned with [`baseline-metrics.mjs`](../../scripts/guards/baseline-metrics.mjs) and §10.2.
- g5 detail reports parsed count (e.g. `114 tests (2.2s)`); fails if count unparseable or below floor.

### REM-025 — Denali scan scope undocumented

**Before:** §6.11 mentioned workspace-sdk only; guard scanned `config` + `platform-core`.

**After:** §6.11 / §9.3 / g2 description aligned — `packages/{workspace-sdk,config,platform-core}`. `gateScope.denaliScanDirs` in phase-0 gate JSON.

### REM-017 — Phase 1 gate SDK bleed

**Before:** Undocumented that `phase-1-guard` g2b runs workspace-sdk ≥ 39.

**After:** Documented in [`phase-1-platform-core.mdoc`](../phase-1-platform-core.mdoc) §7 as **intentional regression floor**; g2b uses enforced parsed count via shared lib.

### REM-013 — `phase-0:gate` = full monorepo build/test

**Resolution (documented, not split):** Trunk integration intentionally runs root `pnpm build` + `pnpm test`. Foundation isolation lives in `phase-0-guard.mjs` only. Note added to §9.2 (`.md` / `.mdoc`); `gateScope` in gate JSON.

### Central thresholds

Single source: [`scripts/guards/gate-thresholds.mjs`](../../scripts/guards/gate-thresholds.mjs)

| Package / check | phase0 | phase1 | phase2 | phase3 |
|-----------------|--------|--------|--------|--------|
| workspace-sdk tests | **13** | **39** | **50** | **100** |
| platform-core tests | — | **94** | — | — |
| ui-primitives tests | — | — | **12** | — |
| theme-react tests | — | — | **4** | — |
| workspace-starter tests | — | — | — | **15** |

All phase guards import `evaluatePackageTestRun` — no duplicate `MIN_*` literals.

---

## Phase 0–3 integrity highlights (post-remediation)

| Area | Verdict |
|------|---------|
| Depcruise (21 forbidden rules) | **PASS** — `guard:architecture` |
| Barrel `@app-tour/ui-primitives` | **0** consumer violations — AST + audit |
| Dual starter plugin | **REM-014 DONE** — SDK core + workspace-starter re-export |
| Tenant headers (API/web) | **REM-002/008 DONE** — tenant-kernel fail-closed |
| theme-react `exports` | **`.` only** — L-01 verify; no `dist/workspace/` publish tree |
| ui-primitives `dist/` | **Allowlist-only** — no `prune-dist` post-hoc |
| Documentation | Phases 0–3 Markdoc + `guard:doc-sync` |

Forensic detail retained in phase-specific audits under [`docs/audits/`](./).

---

## `phase-3:gate` checklist (16/16 required)

From `reports/phase-3-gate-2026-06-03.json` after Wave E run:

| ID | Status | Detail |
|----|--------|--------|
| p3_doc_gate | PASS | |
| p3_apps_web_exists | PASS | |
| p3_apps_api_exists | PASS | |
| p3_apps_web_lint | PASS | |
| p3_audit_boundary | PASS | |
| p3_import_boundary | PASS | |
| p3_guard_architecture | PASS | |
| p3_artifact_surface | PASS | |
| p3_workspace_sdk_tests | PASS | **114** tests (≥ 100 enforced) |
| p3_starter_build | PASS | |
| p3_starter_tests | PASS | **19** tests (≥ 15 enforced) |
| p3_theme_react_verify_exports | PASS | |
| p3_api_gate | PASS | |
| p3_web_gate | PASS | |
| p3_canonical_sync | PASS | |
| p3_no_denali | PASS | |
| p3_ui_select_checkbox_optional | optional | select/checkbox not shipped |

---

## Verification commands

```bash
nvm use 24
pnpm run check:node-engine
pnpm run phase-0:guard
pnpm run phase-1:guard
pnpm run phase-3:gate          # full 100% close — ~5 min
pnpm run guard:doc-sync
```

---

## Artifact index

| Artifact | Path |
|----------|------|
| Gate thresholds | `scripts/guards/gate-thresholds.mjs` |
| Test output parser | `scripts/guards/lib/parse-test-output.mjs` |
| Phase 0 guard | `scripts/guards/phase-0-guard.mjs` |
| Phase 3 gate report | `reports/phase-3-gate-2026-06-03.json` |
| Wave E report | `reports/wave-e-status-report-2026-06-03.md` |
| Phase 3 forensic (pre-waves baseline) | `docs/audits/phase-3-zero-debt-forensic-audit.md` |

---

*Architect sign-off: Phases 0–3 platform scaffold is **Zero-Debt Verified** contingent on maintaining green `phase-3:gate` on trunk and acknowledged soft backlog above.*
