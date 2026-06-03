# Brutal Forensic Audit — Phase 0 Red Flags

**Date:** 2026-06-03  
**Stance:** Adversarial Auditor — structural integrity of `packages/` vs. Phase 0 claims  
**Scope:** `packages/`, `scripts/guards/phase-0-guard.mjs`, `scripts/guards/baseline-metrics.mjs`, `scripts/guards/import-boundary-ast.mjs`, `dependency-cruiser.config.js`, `docs/phase-0-foundation.mdoc` (mirror: `docs/phase-0-foundation.md`)  
**Verdict:** Phase 0 is **documented as a closed foundation**, but the repo is a **multi-package product monorepo** (platform-core, design system, apps). `pnpm run phase-0:gate` exit 0 proves **trunk integration**, not that Phase 0 isolation rules are complete or enforced on all “new” packages.

---

## 1. Abstraction leak — “Platform Foundation” vs. regular monorepo

Phase 0 docs frame `@app-tour/workspace-sdk` as the contract kernel with a **single declared runtime npm dep** (`@casl/ability`). The tree under `packages/` is a **full layered stack** with workspace `dependencies`, React peers, and cross-package `@app-tour/*` imports — the same shape as a conventional pnpm monorepo, not a dependency-free “foundation layer.”

### RF-P0-ABS-01 — Seven production packages under `packages/`, not “SDK + config”

| Field | Value |
|-------|--------|
| **Claim** | §3.1 hard outputs: `workspace-sdk`, `config`, depcruise, guards (foundation) |
| **Reality** | Baseline JSON lists **config, design-tokens, platform-core, theme-react, ui-primitives, workspace-sdk, workspaces**; root `pnpm build` chains all of them plus `apps/api` |
| **File:lines** | `docs/phase-0-foundation.mdoc:104-114` — hard checklist |
| | `reports/phase-0-baseline-2026-06-03.json:21-31` — `new_packages` + `platform_core_exists` + `apps_exists` |
| | `package.json:10` — `build` filter chain includes platform-core, design-tokens, workspace-starter, ui-primitives, theme-react, apps/api |
| **Liability** | “Phase 0 complete” reads as contract freeze; actual artifact is Phase 1–3 stack already built |

### RF-P0-ABS-02 — `workspace-sdk` ships runtime CASL (`@casl/ability`), not a types-only contract

| Field | Value |
|-------|--------|
| **Claim** | §6.1: contract without UI/Nest; §6.2: only runtime npm is `@casl/ability` |
| **Reality** | Production `auth/ability.ts` imports `AbilityBuilder`, `createMongoAbility` from `@casl/ability` — authority logic lives in the “contract” package |
| **File:lines** | `packages/workspace-sdk/package.json:19-21` — `"@casl/ability": "^6.7.3"` |
| | `packages/workspace-sdk/src/auth/ability.ts:10-15` — `from "@casl/ability"` |
| | `packages/workspace-sdk/src/auth/subjects.ts:1` — `import { subject } from "@casl/ability"` |
| | `docs/phase-0-foundation.mdoc:207` — “بدون UI، بدون Nest” |
| | `docs/phase-0-foundation.mdoc:624-625` — Appendix C documents CASL exports (retrofit Phase 2–3) |
| **Liability** | Consumers inherit CASL version lock-in from “foundation”; not a portable DTO-only SDK |

### RF-P0-ABS-03 — `platform-core` is a runtime engine package (Phase 1) inside Phase 0 gate path

| Field | Value |
|-------|--------|
| **Claim** | §11: `packages/platform-core` belongs in **1.x**, not Phase 0 |
| **Reality** | Package exists with runtime dep on `workspace-sdk`; engine imports SDK types across `src/engine/*` |
| **File:lines** | `docs/phase-0-foundation.mdoc:537` — “platform-core → 1.x” |
| | `docs/phase-0-foundation.mdoc:184-186` — tree already lists `platform-core/` under Phase 0 diagram |
| | `packages/platform-core/package.json:20-22` — `"@app-tour/workspace-sdk": "workspace:*"` |
| | `packages/platform-core/src/engine/platform-wizard.engine.ts:1-8` — `from "@app-tour/workspace-sdk"` |
| **Liability** | Phase boundary in docs is advisory; CI treats engine + apps as Phase 0 green |

### RF-P0-ABS-04 — `theme-react` is a React runtime layer on SDK + design-tokens

| Field | Value |
|-------|--------|
| **Claim** | §11: “scaffold سیستم theme/design-tokens در فاز ۰ → 2.x” |
| **Reality** | `theme-react` has workspace runtime deps and imports `react` in provider source |
| **File:lines** | `docs/phase-0-foundation.mdoc:541` — theme scaffold deferred to 2.x |
| | `packages/theme-react/package.json:28-31` — dependencies on `design-tokens`, `workspace-sdk` |
| | `packages/theme-react/package.json:32-35` — `react` / `react-dom` peer only |
| | `packages/theme-react/src/providers/TenantThemeProvider.tsx:3-4` — `from "@app-tour/workspace-sdk"` + `from "react"` |
| | `packages/theme-react/src/providers/ThemeProviderChain.tsx:11` — `from "@app-tour/workspace-sdk"` |
| **Liability** | Design-system runtime is indistinguishable from a normal feature package; not “foundation” |

### RF-P0-ABS-05 — `ui-primitives` uses `react` in shipped components; only `design-tokens` declared as dependency

| Field | Value |
|-------|--------|
| **Claim** | Phase 2 doc matrix: `ui-primitives-only-design-tokens` (depcruise) |
| **Reality** | All primitives import `react`; `react` is **peerDependencies** only — resolution relies on hoisting / consumer install, not declared runtime deps |
| **File:lines** | `packages/ui-primitives/package.json:51-57` — deps: design-tokens only; peers: react |
| | `packages/ui-primitives/src/Button/Button.tsx:1` — `from "react"` |
| | `packages/ui-primitives/src/Input/Input.tsx:1` — `from "react"` |
| | `packages/ui-primitives/src/FieldShell/FieldShell.tsx:1` — `from "react"` |
| **Liability** | Strict npm consumer (no peer install) can resolve package graph differently than CI workspace |

### RF-P0-ABS-06 — `workspace-starter` pulls engine + tokens + SDK (vertical slice, not contract)

| Field | Value |
|-------|--------|
| **Claim** | §6.8: production plugin in Phase 3; SDK reference must not import `workspaces/*` |
| **Reality** | Starter package depends on **three** `@app-tour/*` runtime packages |
| **File:lines** | `packages/workspaces/starter/package.json:24-28` — design-tokens, platform-core, workspace-sdk |
| | `packages/workspaces/starter/src/starter.plugin.ts:8` — `from "@app-tour/workspace-sdk"` |
| | `packages/workspaces/starter/src/starter.plugin.spec.ts:4-13` — platform-core + workspace-sdk |
| **Liability** | “Foundation” gate green while workspace implementation package is already in graph |

### RF-P0-ABS-07 — SDK reference comments encode coupling to `@app-tour/workspace-starter` path

| Field | Value |
|-------|--------|
| **Claim** | §6.2: SDK **بدون** `@app-tour/*` workspace packages |
| **Reality** | Reference module documents starter package export path (social coupling; no import, but contract drift vector) |
| **File:lines** | `docs/phase-0-foundation.mdoc:216` — “بدون `@app-tour/*` workspace packages” |
| | `packages/workspace-sdk/src/reference/starter-plugin-core.ts:7-8` — comment: `published via @app-tour/workspace-starter` |
| **Liability** | Dual-source starter (§6.8) requires manual parity; not enforced in phase-0-guard |

---

## 2. Import lie — undeclared edges and guard bypasses

### RF-P0-IMP-01 — `import-boundary-ast` does not scan `packages/ui-primitives/src` at all

| Field | Value |
|-------|--------|
| **Claim** | §7.1 / §9.3 g4b: AST guard blocks barrel / forbidden paths for foundation |
| **Reality** | `SCAN_ROOTS` lists workspace-sdk, platform-core, theme-react, design-tokens, apps — **not** `ui-primitives` or `workspaces/starter` |
| **File:lines** | `scripts/guards/import-boundary-ast.mjs:18-24` — `SCAN_ROOTS` array |
| | `docs/phase-0-foundation.mdoc:350` — claims import-boundary scans dist for platform-core and workspace-sdk only (partial truth) |
| **Liability** | Forbidden `legacy/` / `workspaces/` string imports in ui-primitives source would not be caught by g4b |

### RF-P0-IMP-02 — `packages/workspaces/starter` source excluded from AST import-boundary scan

| Field | Value |
|-------|--------|
| **Claim** | `workspace-starter-allowed-deps` (depcruise) is sufficient |
| **Reality** | AST guard never walks `packages/workspaces/starter/src`; only depcruise module graph (TypeScript resolution) |
| **File:lines** | `scripts/guards/import-boundary-ast.mjs:18-24` — no `workspaces` path |
| | `dependency-cruiser.config.js:110-117` — `workspace-starter-allowed-deps` |
| **Liability** | Non-literal `require` / dynamic import in starter source: depcruise may miss; AST guard definitely misses |

### RF-P0-IMP-03 — `ui-primitives` production-adjacent files import `theme-react` + `workspace-sdk` without runtime `dependencies`

| Field | Value |
|-------|--------|
| **Claim** | Package boundary: ui-primitives → design-tokens only (depcruise allow-list includes sdk/theme for graph, not package.json) |
| **Reality** | Storybook + visual tests import theme chain and CASL helpers; only listed under **devDependencies** |
| **File:lines** | `packages/ui-primitives/package.json:51-62` — runtime deps vs devDeps |
| | `packages/ui-primitives/.storybook/preview.tsx:5-13` — `@app-tour/theme-react`, `@app-tour/workspace-sdk` |
| | `packages/ui-primitives/test/visual/theme-atoms.spec.tsx:8-17` — same imports |
| **Liability** | Workspace hoisting masks missing runtime declarations; published package.json does not declare graph used in repo |

### RF-P0-IMP-04 — `apps/web` dynamic `import()` to relative registry evades package-level forbidden rules

| Field | Value |
|-------|--------|
| **Claim** | §7.1: depcruise + import-boundary enforce architecture |
| **Reality** | Loader uses dynamic import with **relative** specifier; AST guard only flags dynamic import when specifier matches `FORBIDDEN` regex set — not relative plugin graph |
| **File:lines** | `apps/web/src/wizard/load-workspace-plugin.ts:6-8` — `await import("../bootstrap/workspace-plugin-registry")` |
| | `scripts/guards/import-boundary-ast.mjs:45-53` — `FORBIDDEN` patterns (no relative-path policy) |
| | `scripts/guards/import-boundary-ast.mjs:444-470` — dynamic import: forbidden only if `isForbiddenModule(arg.text)` |
| **Liability** | “Dynamic plugins” are still static graph edges invisible to Phase 0 coupling metrics |

### RF-P0-IMP-05 — Guard script itself uses `createRequire("typescript")` (undeclared in any `packages/*` package.json)

| Field | Value |
|-------|--------|
| **Claim** | Import boundaries enforced consistently |
| **Reality** | `import-boundary-ast.mjs` loads TypeScript compiler via `createRequire` — relies on root hoisted `devDependencies`, not declared per scanned package |
| **File:lines** | `scripts/guards/import-boundary-ast.mjs:9-13` — `createRequire` + `require("typescript")` |
| | `package.json:39-44` — `typescript` only at repo root devDependencies |
| **Liability** | Proves guards depend on implicit workspace root deps — same class of leak Phase 0 claims to eliminate |

### RF-P0-IMP-06 — `dependency-cruiser` ignores `node_modules` and has no circular-dependency rule

| Field | Value |
|-------|--------|
| **Claim** | §1.2 / §7.1: “قانون import از روز ۱ — dependency-cruiser blocking” |
| **Reality** | Options `doNotFollow: node_modules|dist|legacy`; forbidden rules are path-based only — **no** `no-circular-dependencies` (legacy config had one) |
| **File:lines** | `dependency-cruiser.config.js:3-157` — forbidden rules only |
| | `dependency-cruiser.config.js:158-162` — `doNotFollow`, no cycle rule |
| | `legacy/dependency-cruiser.config.js:50` — `no-circular-dependencies` (exists in archive, not app-tour) |
| **Liability** | Circular TS/barrel cycles among `packages/*` can grow until runtime/ bundler failure — gate silent |

### RF-P0-IMP-07 — `theme-react` build uses `createRequire` in verify script (literal path calls whitelisted empty)

| Field | Value |
|-------|--------|
| **Claim** | AST blocks `createRequire` abuse |
| **Reality** | `verify-export-allowlist.mjs` uses `createRequire`; whitelist `CREATE_REQUIRE_CALL_WHITELIST` is empty — script path may be outside `SCAN_ROOTS` walk |
| **File:lines** | `packages/theme-react/scripts/verify-export-allowlist.mjs:8` — `createRequire` |
| | `packages/theme-react/scripts/verify-export-allowlist.mjs:147` — `createRequire(path.join(packageRoot, "package.json"))` |
| | `scripts/guards/import-boundary-ast.mjs:41-42` — `CREATE_REQUIRE_CALL_WHITELIST = new Set([])` |
| **Liability** | Non-literal module loading in tooling bypasses the same rules applied to product code |

### RF-P0-IMP-08 — Denali substring guard skips packages that baseline already counts as “new”

| Field | Value |
|-------|--------|
| **Claim** | §10: `denali_token_new_packages` = 0 (zero coupling) |
| **Reality** | `design-tokens/tokens.meta.json` contains literal `"denali"` in `forbiddenPatterns` — layer **not** in `NEW_PACKAGE_LAYERS` / g2 scan dirs |
| **File:lines** | `packages/design-tokens/tokens.meta.json:125` — `"forbiddenPatterns": ["denali", "tour-green"]` |
| | `scripts/guards/baseline-metrics.mjs:22-27` — layers: config, workspace-sdk, platform-core, workspaces only |
| | `scripts/guards/phase-0-guard.mjs:19-23` — same three + config for g2 |
| **Liability** | “Zero denali tokens” is **under-scoped**; meta file would fail only if `validate-design-tokens` runs (Phase 2 gate, not Phase 0) |

---

## 3. Gate illusion — `pnpm run phase-0:gate` theatrical coverage

### RF-P0-GATE-01 — Phase 0 gate script is full monorepo build + test + apps

| Field | Value |
|-------|--------|
| **Claim** | §9: “CI gate فاز ۰” / §9.3 foundation checks |
| **Reality** | `phase-0:gate` = root `pnpm build` + `pnpm test` (includes apps/api, apps/web) then guards |
| **File:lines** | `package.json:31` — `phase-0:gate` definition |
| | `package.json:10-14` — build/test include Phase 3 apps |
| | `docs/phase-0-foundation.mdoc:461` — REM-013 admits full monorepo scope |
| | `.github/workflows/phase-0-gate.yml:41-42` — runs `pnpm run phase-0:gate` |
| **Liability** | Green Phase 0 badge means “whole repo compiles”; not “foundation packages isolated” |

### RF-P0-GATE-02 — `phase-0-guard.mjs` is six checks; five are narrow or delegated

| Field | Value |
|-------|--------|
| **Claim** | §9.3 table — foundation gate |
| **Reality** | g1 dist exists; g2 denali rg on **3** dirs; g3 legacy substring; g4/g4b spawn depcruise + import-boundary; g5 SDK test count floor **13** |
| **File:lines** | `scripts/guards/phase-0-guard.mjs:63-160` — check implementations |
| | `scripts/guards/phase-0-guard.mjs:224` — exit note: “foundation gate: dist + denali-free…” |
| **Liability** | Passing guard does not prove apps absent, theme/ui absent, or starter parity |

### RF-P0-GATE-03 — g2 denali scan excludes `design-tokens`, `theme-react`, `ui-primitives`

| Field | Value |
|-------|--------|
| **Claim** | §6.11 / §10.2: denali tokens 0 in new packages |
| **Reality** | g2 paths = workspace-sdk, config, platform-core only (spec exclusion) |
| **File:lines** | `scripts/guards/phase-0-guard.mjs:19-23` — `DENALI_SCAN_DIRS` |
| | `scripts/guards/phase-0-guard.mjs:76` — `rg -i denali` … `-g '!**/*.spec.ts'` |
| | `docs/phase-0-foundation.mdoc:339` — exit 0.2 cites same limited paths |
| **Liability** | Denali string in design-tokens meta or comments in ui-primitives never fails Phase 0 |

### RF-P0-GATE-04 — g3 legacy detection is substring grep, not module resolution

| Field | Value |
|-------|--------|
| **Claim** | §3.1 / g3: no legacy imports under packages |
| **Reality** | Only matches `legacy/`, `from "../legacy`, `from '../legacy` — misses package name aliases, re-exports, `node:` tricks, dist-only requires |
| **File:lines** | `scripts/guards/phase-0-guard.mjs:89-98` — `checkNoLegacyImportsInPackages` |
| | `scripts/guards/baseline-metrics.mjs:67-68` — identical pattern for `legacy_import_edges` |
| **Liability** | AST-evading or `legacy` without slash path → false negative |

### RF-P0-GATE-05 — g5 test floor (≥ 13) is trivial vs. current 114 tests

| Field | Value |
|-------|--------|
| **Claim** | §3.1 / §6.10: “≥ 13 unit test (enforced)” |
| **Reality** | Floor is **7.6%** of current count; guard parses runner output but does not assert coverage, adversarial cases, or contract invariants |
| **File:lines** | `scripts/guards/gate-thresholds.mjs:7-9` — `phase0: 13` |
| | `scripts/guards/phase-0-guard.mjs:139-160` — g5 |
| | `docs/phase-0-foundation.mdoc:325-331` — documents 114 tests vs min 13 |
| **Liability** | Gate allows massive test deletion until 12 cases remain |

### RF-P0-GATE-06 — No circular-dependency enforcement in app-tour depcruise config

| Field | Value |
|-------|--------|
| **Claim** | §7.1 blocking architecture guard |
| **Reality** | `guard:architecture` runs depcruise forbidden rules only; JSON summary shows `dependencyCycles` empty but **no rule** registers cycles as violations in this config |
| **File:lines** | `package.json:16` — `depcruise packages apps` |
| | `dependency-cruiser.config.js:1-163` — no circular rule |
| **Liability** | Edge case: circular imports between barrels in sdk/platform-core — gate blind unless manual audit |

### RF-P0-GATE-07 — Dynamic import with non-forbidden relative path: intentionally allowed

| Field | Value |
|-------|--------|
| **Claim** | import-boundary blocks dynamic loaders |
| **Reality** | Only `computed-dynamic-import` when arg is not string literal; relative registry import is string literal and not in `FORBIDDEN` |
| **File:lines** | `scripts/guards/import-boundary-ast.mjs:444-470` |
| | `apps/web/src/wizard/load-workspace-plugin.ts:7` |
| **Liability** | Documented “dynamic plugins” bypass Phase 0 import theater |

### RF-P0-GATE-08 — Dist scan regex can miss non-literal bundler emitted paths

| Field | Value |
|-------|--------|
| **Claim** | g4b scans `platform-core/dist` + `workspace-sdk/dist` |
| **Reality** | `scanDistFile` uses substring `FORBIDDEN` + `require("...")` regex — concatenated specs, variable requires, import() in emitted chunks not matching regex |
| **File:lines** | `scripts/guards/import-boundary-ast.mjs:481-513` — `scanDistFile` |
| | `scripts/guards/import-boundary-ast.mjs:36-39` — only two dist roots (not ui-primitives/theme-react dist) |
| **Liability** | Post-build artifact policy is partial and pattern-based |

### RF-P0-GATE-09 — `phase-0:gate` does not run `guard:doc-sync`, `validate-design-tokens`, or `phase-1:guard`

| Field | Value |
|-------|--------|
| **Claim** | §12.9: `pnpm run guard:doc-sync` required for Phase 0 exit |
| **Reality** | `phase-0:gate` chain ends at `baseline:metrics` — no doc-sync, no token validator, no symlink guard |
| **File:lines** | `package.json:31` — phase-0:gate scripts |
| | `docs/phase-0-foundation.mdoc:562` — checklist item 9 `guard:doc-sync` |
| | `docs/phase-0-foundation.mdoc:610` — appendix commands include `guard:doc-sync` separately |
| | `package.json:12` — `validate-design-tokens` only in `phase-2:gate` |
| **Liability** | Documented strict exit criteria ≠ automated Phase 0 gate |

### RF-P0-GATE-10 — Pre-commit `ci:integrity` runs phase-0:gate + phase-1-guard but not doc-sync

| Field | Value |
|-------|--------|
| **Claim** | §9.2 pre-commit parity |
| **Reality** | Husky path still omits `guard:doc-sync` from §12.9 |
| **File:lines** | `docs/phase-0-foundation.mdoc:475` — `ci:integrity` composition |
| | `scripts/ci-integrity-check.sh` — (invoked by package.json `ci:integrity`) |
| **Liability** | Docs-as-Code §19 enforcement is manual/opt-in for Phase 0 |

---

## 4. Doc drift — “strict” in `phase-0-foundation.mdoc` without build/test enforcement

### RF-P0-DOC-01 — Status banner “✅ تکمیل” conflicts with §11 forbidden packages that already exist

| Field | Value |
|-------|--------|
| **Doc claim** | Line 15: Phase 0 **complete**; enter Phase 1 |
| **Repo reality** | `platform-core`, `design-tokens`, `theme-react`, `ui-primitives`, `workspaces/starter`, `apps/*` exist and build under `phase-0:gate` |
| **File:lines** | `docs/phase-0-foundation.mdoc:15-16` |
| | `docs/phase-0-foundation.mdoc:533-541` — §11 table |
| | `reports/phase-0-baseline-2026-06-03.json:30-31` |
| **Enforcement** | None in `phase-0-guard.mjs` — no “apps must not exist” check |

### RF-P0-DOC-02 — §6.1 “بدون UI” vs. SDK `theme/*` + CASL `auth/*` exports

| Field | Value |
|-------|--------|
| **Doc claim** | §6.1: no UI, no Nest — shared language only |
| **Repo reality** | `index.ts` exports theme ingress, presets, tenant theme validation, full CASL surface |
| **File:lines** | `docs/phase-0-foundation.mdoc:207` |
| | `packages/workspace-sdk/src/index.ts:77-97` — theme exports |
| | `packages/workspace-sdk/src/index.ts:116-134` — auth / CASL exports |
| | `docs/phase-0-foundation.mdoc:237` — theme field “فاز ۲+ retrofit” but gate does not block theme exports in Phase 0 |
| **Enforcement** | None — no export allowlist guard in phase-0 |

### RF-P0-DOC-03 — §10.1 “coupling score … باید صفر بماند” — metric does not measure cross-package coupling

| Field | Value |
|-------|--------|
| **Doc claim** | Zero coupling in new packages |
| **Repo reality** | Baseline counts denali **strings** + legacy **substring** imports; depcruise not invoked in baseline-metrics |
| **File:lines** | `docs/phase-0-foundation.mdoc:504` |
| | `scripts/guards/baseline-metrics.mjs:60-68` — denali + legacy rg only |
| | `scripts/guards/baseline-metrics.mjs:77` — note: “zero coupling in new packages + SDK test floor” |
| **Enforcement** | `t2_denali_tokens`, `t3_legacy_imports` only — no edge-count / depcruise metrics |

### RF-P0-DOC-04 — §6.2 “بدون `@app-tour/*` workspace packages” — not machine-checked

| Field | Value |
|-------|--------|
| **Doc claim** | SDK must not depend on other workspace packages |
| **Repo reality** | True for `dependencies` in package.json; **not** true for dev tooling, tests, or duplicate starter shapes |
| **File:lines** | `docs/phase-0-foundation.mdoc:216` |
| | `packages/workspace-sdk/package.json:19-21` — only @casl |
| **Enforcement** | depcruise `workspace-sdk-no-workspaces` only — no “no @app-tour/* in devDependencies” rule |

### RF-P0-DOC-05 — L-5 “یک sub-phase = یک PR” — social contract, zero automation

| Field | Value |
|-------|--------|
| **Doc claim** | §2 L-5: one sub-phase per PR with `Phase: 0.x` |
| **Repo reality** | No CI check on PR title, commit count, or diff scope per sub-phase |
| **File:lines** | `docs/phase-0-foundation.mdoc:89` |
| | `docs/phase-0-foundation.mdoc:427-442` — PR template (voluntary) |
| **Enforcement** | None |

### RF-P0-DOC-06 — §12 item 9 `guard:doc-sync` — listed in checklist, absent from `phase-0:gate`

| Field | Value |
|-------|--------|
| **Doc claim** | Entry to Phase 1 requires doc-sync |
| **Repo reality** | `phase-0:gate` does not call `guard:doc-sync` |
| **File:lines** | `docs/phase-0-foundation.mdoc:562` |
| | `package.json:22` — script exists |
| | `package.json:31` — not in gate chain |
| **Enforcement** | Manual only |

### RF-P0-DOC-07 — §9.4 remote GitHub Actions — unchecked exit box

| Field | Value |
|-------|--------|
| **Doc claim** | Remote CI green “پس از push” still `[ ]` |
| **Repo reality** | Local gate can pass while remote unchecked — doc admits gap |
| **File:lines** | `docs/phase-0-foundation.mdoc:494` |
| **Enforcement** | N/A — honest drift, but contradicts “✅ تکمیل” banner |

### RF-P0-DOC-08 — §7.1 “Phase 0 core” two rules vs. 21 forbidden rules — enforcement scope undocumented in gate

| Field | Value |
|-------|--------|
| **Doc claim** | §7.1 introduces Phase 0 as `workspace-sdk-no-workspaces` + `no-legacy-imports` |
| **Repo reality** | 21 rules including apps/api/web (Phase 3) — all run under same `guard:architecture` for Phase 0 gate |
| **File:lines** | `docs/phase-0-foundation.mdoc:346-357` — Phase 0 core table |
| | `docs/phase-0-foundation.mdoc:380-391` — Phase 3 rules in same file |
| | `dependency-cruiser.config.js:1-157` |
| **Enforcement** | Single depcruise run — failure in apps blocks “Phase 0” gate (scope bleed) |

### RF-P0-DOC-09 — `design-tokens` “isolated” / forbiddenPatterns — validator not in Phase 0 gate

| Field | Value |
|-------|--------|
| **Doc claim** | §7.1 `design-tokens-isolated`; tokens meta forbids `denali` pattern |
| **Repo reality** | `validate-design-tokens.mjs` enforces meta — wired to **`phase-2:gate`**, not `phase-0:gate` |
| **File:lines** | `docs/phase-0-foundation.mdoc:372-374` |
| | `packages/design-tokens/tokens.meta.json:125` |
| | `scripts/guards/validate-design-tokens.mjs:6` — forbidden patterns |
| | `package.json:35` — validate-design-tokens in phase-2:gate only |
| **Enforcement** | Phase 0 green does not run token meta guard |

### RF-P0-DOC-10 — §3.1 checkbox “dependency-cruiser blocking” — no fail on warnings / orphan modules

| Field | Value |
|-------|--------|
| **Doc claim** | depcruise rules blocking |
| **Repo reality** | `guard:architecture` uses `--output-type err` on violations only; no `orphan`, `unreachable`, or `deprecated` rules configured |
| **File:lines** | `docs/phase-0-foundation.mdoc:107` |
| | `package.json:16` |
| | `dependency-cruiser.config.js:158-162` — options only |
| **Enforcement** | Minimal forbidden graph — not full architectural hygiene |

---

## 5. Summary matrix (PO view)

| Tier | ID range | Theme | Gate can still pass? |
|------|----------|--------|----------------------|
| **P0** | RF-P0-ABS-* | Multi-package monorepo labeled “foundation”; SDK carries CASL runtime | Yes |
| **P0** | RF-P0-IMP-* | ui-primitives / starter outside AST scan; implicit hoisting | Yes |
| **P0** | RF-P0-GATE-* | phase-0:gate = full repo; weak denali/legacy/cycle checks | Yes |
| **P1** | RF-P0-DOC-* | Aspirational strict docs (zero coupling, no UI, one PR, doc-sync) | Yes |

---

## 6. What Phase 0 gates actually prove (honest)

If `pnpm run phase-0:gate` is green, you know:

1. Root `pnpm build` and `pnpm test` succeeded for the **current whole repo** (including apps and Phase 2–3 packages).
2. `dependency-cruiser` forbidden **path rules** found no violations in `packages` + `apps`.
3. `import-boundary-ast` found no hits in **its SCAN_ROOTS** (not full `packages/`).
4. `workspace-sdk/dist/index.js` exists and SDK tests ≥ **13**.
5. Ripgrep found no `denali` in three package dirs (excluding `*.spec.ts`) and no `legacy/` substring imports under `packages/`.

You **do not** know: zero runtime npm graph, no apps, no circular deps, complete denali-free design-tokens, declared-vs-imported dependency parity, or that docs §11/§12 constraints are enforced.

---

*Auditor: adversarial Phase 0 forensic pass. Output file: `audit-red-flags-phase-0.md` only.*
