# Phase 3 — Migration & Technical Debt Readiness Report

| Field | Value |
|-------|--------|
| **Report ID** | `phase-3-readiness-2026-06-04` |
| **Git SHA** | `319129a` |
| **Scope** | Transition Phase 2 (visual) → Phase 3 (apps / starter / CASL integration) |
| **Law** | `docs/phase-3/` modular hub + `docs/phase-3-design-system.mdoc` (Markdoc) |
| **Method** | Repo scan (`rg`, package manifests, depcruise rules, apps/packages tree) vs Phase 3 ideal state |

---

## Executive summary

Phase 2 visual invariants are **gate-backed and green** (`phase-2:gate`, 16× `p2_*`). Phase 3 is **not a greenfield**: `apps/api`, `apps/web`, and `packages/workspaces/starter` already exist with tests and sub-gates. The main risk is **carrying scaffold fragility** (in-memory API storage, dev auth, hard-coded wizard field wiring, unsupported primitive kinds) into production-minded Phase 3 work—not missing packages.

**Verdict:** Proceed to Phase 3 integration work **after** P0 refactors below. Do **not** assume “no Phase 3 code in repo yet.”

---

## Task 1 — Forensic health check

### 1.1 Premature or “hacked” code in `platform-core` / `design-tokens`

| Area | Finding | Severity |
|------|---------|----------|
| `packages/platform-core` | No `@ts-ignore` / `@ts-expect-error` / `TODO` / `FIXME` in `src/`. No imports of `design-tokens`, `ui-primitives`, `theme-react`, `apps/*`, or `workspaces/*`. | **Clean** |
| `packages/platform-core` | `render-plan.ts` comment references “phase 3+” — this is the **intended** headless UI contract, not a bypass. | Info |
| `packages/platform-core` | `@deprecated` on `rule-context-tenant` helper — document migration, not a Phase 3 hack. | P2 |
| `packages/design-tokens` | No Phase 3 app logic; `tokens.meta.json` + CSS + `validate-design-tokens` only. Contract tests added in Phase 2 closure. | **Clean** |

**Conclusion:** No Phase 3 product code was smuggled into core/token packages. Phase 3 consumers belong in `apps/*` and `workspaces/starter` (as today).

### 1.2 Hard-coded configs, TODOs, bypasses (repo-wide Phase 3 paths)

| Check | Result |
|-------|--------|
| `@ts-ignore` / `@ts-expect-error` in `apps/`, `packages/` (excl. `legacy/`) | **0 matches** |
| `TODO` / `FIXME` in `apps/` | **0 matches** (legacy monolith has many — out of scope) |
| `TODO` / `FIXME` in `packages/platform-core`, `design-tokens` | **0 matches** |

**Phase 3 scaffold patterns (not TS bypasses, but reliability debt):**

| Location | Pattern | Risk |
|----------|---------|------|
| `apps/api/src/main.ts` | `InMemoryTourRepository` wired as production store | No durable persistence; blocks real 3.2 |
| `apps/api/src/tenant/tenant-registry.ts` | `DEV_TENANTS` hard-coded registry | Not multi-tenant production |
| `apps/api/src/tenant-kernel/parse-bearer.ts` | `dev.<payload>` unsigned bearer when `AUTH_ALLOW_DEV_BEARER=true` | Must be off in prod |
| `apps/web/src/wizard/workspace-wizard-host.tsx` | `fieldValue` / `setFieldValue` hard-coded to `basics.title`, `details.summary` | Bypasses render-plan-driven binding |
| `apps/web/src/wizard/wizard-field.tsx` | Non-`text` kinds → `data-unsupported-kind` placeholder | Phase 2 primitive gap leaks into UX |

### 1.3 Incomplete Phase 2 features leaking into Phase 3 workspace setup

| Phase 2 backlog | Leak into Phase 3 | Evidence |
|-----------------|-------------------|----------|
| **Select / Checkbox** primitives (FT-P2-04) | Wizard cannot render `enum` / `boolean` from engine plan | No `packages/ui-primitives/Select`; `wizard-field.tsx` only handles `text` |
| **Ingress as public API** (CD-01) | **Not leaked** — apps use `ThemeProviderChain` only | `apps/web/src/providers/app-providers.tsx` |
| **Count-only test floors** | Regression can pass without behavioral depth | Phase 2/3 guards use numeric mins |
| **P2-006 rgba in primitives.css** | Visual debt only | Not blocking Phase 3 wiring |

**Starter plugin:** Re-exports SDK reference plugin (`starter.plugin.ts`) — correct declarative pattern; does not pull ui-primitives (good).

---

## Task 2 — Architectural gap analysis (ideal `docs/phase-3/` vs repo)

### 2.1 Facade-only rule (apps → platform)

| Rule | Ideal | Actual | Status |
|------|--------|--------|--------|
| Apps import `platform-core` via package entry only | `PlatformWizardEngine`, plan types from `@app-tour/platform-core` | `apps/web`, `apps/api`, `starter` tests use barrel imports only | **PASS** |
| No `platform-core/src/**` deep imports in apps | Forbidden | `rg` → 0 in `apps/` | **PASS** |
| API must not import ui-primitives / theme-react | P3-E-API-01 | `apps/api/package.json` — no visual deps | **PASS** |
| Web uses ui-primitives **subpaths** only | P3-E-BARREL | `@app-tour/ui-primitives/button`, `/input`; barrel-hunt tests | **PASS** |

**Gap (P1):** `apps/web/package.json` lists `"@app-tour/ui-primitives": "workspace:*"` (whole package). Imports are subpath-clean, but Next transpile scope should stay subpath-only per policy (`next.config.ts` already lists package — verify no barrel resolution in bundler).

### 2.2 Cyclic dependencies (apps / starter)

```text
apps/web → platform-core, workspace-sdk, theme-react, ui-primitives, workspace-starter, design-tokens
apps/api → platform-core, workspace-sdk, workspace-starter, tenant-kernel, platform-events
workspace-starter → workspace-sdk, platform-core, design-tokens
platform-core → workspace-sdk only
```

| Cycle check | Result |
|-------------|--------|
| `platform-core` → `apps/*` or `workspaces/*` | **None** |
| `workspace-sdk` → apps or starter | **None** |
| `starter` → `apps/*` | **None** |
| `apps` → `starter` (allowed bootstrap) | **One-way** |

**Allowed by docs:** `workspace-starter` may depend on `platform-core` for plugin load tests (`subphases/3.1-workspace-starter.md` — `deps_allowed`).

**Probe package:** `packages/workspaces/denali` exists **only** for negative depcruise fixtures — not a product workspace (Phase 6). Do not import in apps (guarded by tests).

### 2.3 Phase 2 visual exports vs Phase 3 consumption

| Package | Export law | Apps usage | Leak? |
|---------|------------|------------|-------|
| `ui-primitives` | Subpath-only, no `.` barrel | Subpath imports in web shell/wizard | **No internal leak** |
| `theme-react` | `"."` only; ingress internal | `ThemeProviderChain` + CASL props in `AppProviders` | **No `theme-react/internal`** in apps |
| `design-tokens` | Multi-subpath (token package law) | `globals.css` import in web | OK |

**Gap (P0):** Engine may emit field kinds (enum, boolean, number) that **Phase 2 never shipped** as primitives — Phase 3 web host must either implement 3.3.x or narrow starter plugin fields to `text` only until then.

### 2.4 Ideal vs actual — Phase 3 program state

| Ideal (`docs/phase-3/phase-3-overview.md`) | Repo actual | Gap |
|--------------------------------------------|-------------|-----|
| Subphases 3.0–3.5 closed, `phase-3:gate` exit 0 | Scaffold + tests present; **no** `reports/phase-3-gate-*.json` in `reports/` | Run gate and archive report |
| `ci:integrity` includes Phase 3 | `ci-integrity-check.sh` runs **phase-0 → phase-3** (P0-01 closed 2026-06-04) | Pre-commit enforces full chain |
| Thin API with real tenant DB (3.2) | **In-memory** canonical store in `main.ts` | P0 for production path |
| Web shell dynamic workspace bootstrap | Static `listBootstrapWorkspacePlugins()` → starter only | P1 until tenant-kernel resolves by host |
| Phase 4 deferred | `tenant-kernel`, `platform-events` already in **apps/api** deps | P1 — document as “4.x scaffold inside 3.x tree” |

---

## Task 3 — Cursor / AI session preparation

### 3.1 Context to drop (invalid Phase 2 assumptions)

Do **not** carry these into Phase 3 prompts:

- “`ci:integrity` stops at Phase 2” — it now runs **phase-3:gate** (P0-01 closed).
- “Appendix G JSON in old md files” — bind to `package.json` + `docs/phase-3/phase-3-ci.md`.
- “`validateWorkspaceThemeIngress` is a public integrator API” — use `WorkspaceThemeProvider` / `ThemeProviderChain`.
- “Phase 3 repo is empty” — `apps/*` and `workspace-starter` already exist.
- “Select/Checkbox are Phase 2 gate blockers” — they are **backlog** (3.3.x), but web must handle or restrict kinds.

### 3.2 Session persona (Phase 3)

```yaml
persona: "Workspace / App Integration Architect"
focus:
  - Dependency graph: apps → platform packages → workspace-sdk (no reverse edges)
  - Dynamic workspace bootstrap (no static workspaces/denali in apps)
  - CASL before theme ingress (ThemeProviderChain props — already in theme-react)
  - Canonical SoT only (3.4) — no dual-write to legacy tables
  - Subpath-only ui-primitives in apps/web
gates:
  before_merge: "pnpm run phase-3:gate"
  before_phase_3_pr: "pnpm run phase-2:gate green (frozen baseline inside phase-3:gate)"
  docs: "pnpm run doc-gate before 3.1+ doc merges"
do_not:
  - Add barrel imports in apps
  - Import theme ingress helpers from theme-react entry
  - Wire Denali workspace in shell (Phase 6)
```

### 3.3 Recommended first commands (human or agent)

```bash
cd /home/hamed/Music/docs
nvm use && corepack enable
pnpm run phase-2:gate    # frozen visual baseline
pnpm run phase-3:gate    # full 3.x closure + report artifact
pnpm run phase-3:api-gate --filter @apps/api   # optional slice
pnpm --filter @apps/web run phase-3:web-gate     # optional slice
```

---

## Priority backlog

### [P0] Critical — before treating Phase 3 as production-ready

| ID | Item | Why | Where |
|----|------|-----|-------|
| P0-01 | ~~Run and archive `pnpm run phase-3:gate`~~ | **Closed** — `ci:integrity` + `reports/phase-3-gate-2026-06-04.json` | CI + `reports/` |
| P0-02 | **Replace `InMemoryTourRepository` in API hot path** | `main.ts` uses in-memory as live store | `apps/api/src/main.ts` |
| P0-03 | **Production auth path** — disable dev bearer / document env guards | `AUTH_ALLOW_DEV_BEARER`, `DEV_TENANTS` | `apps/api/src/tenant-kernel/*`, `tenant-registry.ts` |
| P0-04 | **Wizard binding** — drive fields from `RenderFieldPlan` / canonical paths, not hard-coded IDs | Fragile dual-write with draft shape | `workspace-wizard-host.tsx` |
| P0-05 | **Field kind strategy** — implement Select/Checkbox (3.3.x) **or** restrict starter plugin + engine to `text` until shipped | Phase 2 leakage | `wizard-field.tsx`, starter plugin contract |

### [P1] Technical debt — manage during Phase 3

| ID | Item | Why |
|----|------|-----|
| P1-01 | ~~Add phase-3:gate to pre-commit~~ | **Closed** — full chain in `ci-integrity-check.sh`; expect long pre-commit |
| P1-02 | Clarify **Phase 4 packages** in `apps/api` (`tenant-kernel`, `platform-events`) vs Phase 3 DoD | Avoid false “Phase 3 only” mental model |
| P1-03 | **Dynamic plugin resolution** by tenant/host (replace static `STARTER_PLUGINS` array) | `workspace-plugins.ts` comment admits gap |
| P1-04 | Align **doc closure claims** (`phase-3-overview` “Closed”) with operator checklist | Prevents false confidence |
| P1-05 | `apps/web` whole-package `ui-primitives` dependency vs subpath-only policy | Bundler / audit clarity |
| P1-06 | Update stale `ci-integrity-check.sh` header comment | Still says “phase-1-guard delta” only |

### [P2] Incomplete Phase 2 → explicit backlog (do not block 3.0–3.2 scaffold)

| ID | Item | Notes |
|----|------|-------|
| P2-01 | Select / Checkbox primitives (FT-P2-04) | Gate-non-blocking; track as 3.3.x |
| P2-02 | P2-006 rgba shadows in `primitives.css` | Visual polish |
| P2-03 | Count-only guard floors (Phase 2/3) | Strengthen with contract specs over time |
| P2-04 | `workspace-denali` probe package | Keep for depcruise; never product-import |
| P2-05 | `legacy/` TODO noise | Exclude from Phase 3 agent search paths |

---

## Verification matrix (reproducible)

```bash
# Premature core/token coupling
rg 'design-tokens|ui-primitives|theme-react|apps/|workspaces/' packages/platform-core/src packages/design-tokens

# TS bypasses in Phase 3 tree
rg '@ts-ignore|@ts-expect-error' apps packages --glob '!legacy/**'

# Barrel / internal leaks in apps
rg '@app-tour/ui-primitives["\x27];|theme-react/internal' apps
rg 'platform-core/src' apps

# Denali in product apps
rg -i 'denali|workspaces/denali' apps --glob '!**/*.spec.*'

# Phase 3 gate
pnpm run phase-3:gate
ls reports/phase-3-gate-*.json
```

---

## Related artifacts

| Doc | Path |
|-----|------|
| Phase 3 hub | [`docs/phase-3/README.md`](docs/phase-3/README.md) |
| Phase 3 CI truth | [`docs/phase-3/phase-3-ci.md`](docs/phase-3/phase-3-ci.md) |
| Phase 2 audit | [`audit-logs/phase-2-temp-report.md`](audit-logs/phase-2-temp-report.md) |
| Phase 2 action checklist | [`audit-logs/phase-2-action-checklist.md`](audit-logs/phase-2-action-checklist.md) |
| Phase 3.2 red flags | [`reports/phase-3.2-red-flag-status-2026-06-04.md`](reports/phase-3.2-red-flag-status-2026-06-04.md) |

---

*Generated for Phase 3 entry. Re-run after any change to `apps/*`, `workspaces/starter`, or gate scripts.*
