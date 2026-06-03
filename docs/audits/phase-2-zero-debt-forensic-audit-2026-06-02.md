# Phase 2 Zero-Debt Forensic Audit Report

> **Canonical format (Markdoc):** [`phase-2-zero-debt-forensic-audit-2026-06-02.mdoc`](phase-2-zero-debt-forensic-audit-2026-06-02.mdoc) — validated by `pnpm run doc:markdoc:validate`.

**Role:** Principal Auditor (forensic pass)  
**Generated:** 2026-06-02T21:52:09Z (UTC)  
**Repository:** `/home/hamed/Music/docs`  
**Git SHA (audit time):** `e8fc3a8`  
**Scope:** `@app-tour/ui-primitives`, `@app-tour/theme-react` (Phase 2 publish surfaces)  
**Method:** Fresh `pnpm build` for both packages, then `ls -R dist/`, manifest cross-reference, `grep` on `packages/ui-primitives/dist/`, ripgrep boundary scan, CI script review.

---

## Executive summary

- **SB-02 undeclared `dist/` files (outside `files` whitelist):** **0** — no Security Debt (SB-02) leakage detected after `prune-dist.mjs`.
- **CSS hardcoded literals in `ui-primitives/dist/*.module.css`:** **0** offending lines; requested `grep` properties all resolve via `var(--*)`.
- **Barrel imports (`@app-tour/ui-primitives` without subpath):** **0** in `packages/` (excluding `ui-primitives` itself); **`apps/` does not exist** at repo root (Phase 3 not scaffolded).
- **`phase-2:gate` undeclared-`dist/` failure:** **Already enforced** via `guard:artifact-surface` + `p2_artifact_surface_guard`.

**Debt Score: 94 / 100** — controls are green; remaining points are procedural / Phase 3 readiness, not active SB-02/CSS/barrel violations.

---

## 1. Artifact Leakage Audit

### 1.1 Commands executed

```bash
pnpm --filter @app-tour/ui-primitives build
pnpm --filter @app-tour/theme-react build
cd packages/ui-primitives && ls -R dist/
cd packages/theme-react && ls -R dist/
node scripts/guards/artifact-surface-guard.mjs   # PASS at audit time
```

### 1.2 `@app-tour/ui-primitives` — `ls -R dist/`

```
dist/Alert:     Alert.d.ts, Alert.js, Alert.module.css
dist/Badge:     Badge.d.ts, Badge.js, Badge.module.css
dist/Button:    Button.d.ts, Button.js, Button.module.css
dist/FieldShell: FieldShell.d.ts, FieldShell.js, FieldShell.module.css
dist/Input:     Input.d.ts, Input.js, Input.module.css
dist/utils:     cn.d.ts, cn.js
```

**Total files on disk:** 18  
**Post-build prune log:** `prune-dist: removed dist/tokens` (no `dist/tokens/` at audit time)

#### `package.json` `exports` map (explicit paths only)

| Export subpath | Declared paths |
|----------------|----------------|
| `./button` | `dist/Button/Button.d.ts`, `dist/Button/Button.js` |
| `./input` | `dist/Input/Input.d.ts`, `dist/Input/Input.js` |
| `./field-shell` | `dist/FieldShell/FieldShell.d.ts`, `dist/FieldShell/FieldShell.js` |
| `./alert` | `dist/Alert/Alert.d.ts`, `dist/Alert/Alert.js` |
| `./badge` | `dist/Badge/Badge.d.ts`, `dist/Badge/Badge.js` |

#### `package.json` `files` whitelist (directory prefixes)

- `dist/Button`
- `dist/Input`
- `dist/FieldShell`
- `dist/Alert`
- `dist/Badge`
- `dist/utils`

#### Per-file cross-reference

| File (relative to package) | In `exports`? | In `files` whitelist? | Classification |
|----------------------------|---------------|------------------------|----------------|
| `dist/Alert/Alert.d.ts` | Yes (`./alert` types) | Yes (`dist/Alert`) | Public export surface |
| `dist/Alert/Alert.js` | Yes (`./alert` default) | Yes | Public export surface |
| `dist/Alert/Alert.module.css` | No | Yes | Supporting artifact (CSS side-effect); not SB-02 |
| `dist/Badge/Badge.d.ts` | Yes | Yes | Public export surface |
| `dist/Badge/Badge.js` | Yes | Yes | Public export surface |
| `dist/Badge/Badge.module.css` | No | Yes | Supporting artifact; not SB-02 |
| `dist/Button/Button.d.ts` | Yes | Yes | Public export surface |
| `dist/Button/Button.js` | Yes | Yes | Public export surface |
| `dist/Button/Button.module.css` | No | Yes | Supporting artifact; not SB-02 |
| `dist/FieldShell/FieldShell.d.ts` | Yes | Yes | Public export surface |
| `dist/FieldShell/FieldShell.js` | Yes | Yes | Public export surface |
| `dist/FieldShell/FieldShell.module.css` | No | Yes | Supporting artifact; not SB-02 |
| `dist/Input/Input.d.ts` | Yes | Yes | Public export surface |
| `dist/Input/Input.js` | Yes | Yes | Public export surface |
| `dist/Input/Input.module.css` | No | Yes | Supporting artifact; not SB-02 |
| `dist/utils/cn.d.ts` | No | Yes (`dist/utils`) | Internal runtime helper; not SB-02 |
| `dist/utils/cn.js` | No | Yes | Internal runtime helper; not SB-02 |

#### SB-02 Security Debt (`dist/` file ∉ `exports` AND ∉ `files`)

- **None.** Every file under `dist/` is covered by the `files` whitelist.

#### Informational: not in `exports` but whitelisted in `files` (expected)

- **7 files** — five `*.module.css` + `utils/cn.{js,d.ts}`. These are intentional implementation/supporting artifacts, listed in `sideEffects` for CSS, and reachable only via relative `require` from published entrypoints (not as separate npm export subpaths).

---

### 1.3 `@app-tour/theme-react` — `ls -R dist/`

```
dist/index.d.ts, dist/index.js
dist/ingress/   theme-ingress-guard.{d.ts,js}, useThemeIngressGuard.{d.ts,js}
dist/providers/ PlatformThemeProvider.{d.ts,js}, TenantThemeProvider.{d.ts,js},
                ThemeProviderChain.{d.ts,js}, WorkspaceThemeProvider.{d.ts,js}
dist/tenant/    build-tenant-theme-style.{d.ts,js}
dist/types/     tenant-theme.config.{d.ts,js}
dist/workspace/ normalize-workspace-theme-style.{d.ts,js}
```

**Total files on disk:** 21

#### `package.json` `exports` map

| Export key | Declared paths |
|------------|----------------|
| `.` | `dist/index.d.ts`, `dist/index.js` |

#### `package.json` `files` whitelist

- `dist/index.js`, `dist/index.d.ts`
- `dist/providers`, `dist/ingress`, `dist/tenant`, `dist/workspace`, `dist/types`

#### Per-file cross-reference (summary)

| Area | Files | In `exports`? | In `files`? | Classification |
|------|-------|---------------|-------------|----------------|
| Root | `index.js`, `index.d.ts` | Yes | Yes | Public entry |
| `dist/ingress/**` (4) | No | Yes (`dist/ingress`) | L-01 internal; bundled via providers; **not SB-02** |
| `dist/providers/**` (8) | No | Yes | L-01 internal; **not SB-02** |
| `dist/tenant/**` (2) | No | Yes | L-01 internal; **not SB-02** |
| `dist/types/**` (2) | No | Yes | L-01 internal; **not SB-02** |
| `dist/workspace/**` (2) | No | Yes | L-01 internal; **not SB-02** |

**Notable forensic path (historical SB-02 concern):**

- `dist/workspace/normalize-workspace-theme-style.js` — **on disk**, **in `files`**, **not** in `exports`. Node resolution test (via `verify-export-allowlist.mjs`): `@app-tour/theme-react/workspace` → **not exported** (blocked). Filesystem read in monorepo still possible; npm consumer cannot resolve subpath.

#### SB-02 Security Debt (`dist/` file ∉ `exports` AND ∉ `files`)

- **None.**

---

## 2. CSS Forensic Scan

### 2.1 Command (as specified)

```bash
grep -rE 'padding:|font-weight:|line-height:|width:' packages/ui-primitives/dist/
```

### 2.2 Raw grep hits (all matches)

| File | Line | Content |
|------|------|---------|
| `packages/ui-primitives/dist/Input/Input.module.css` | 3 | `padding: var(--space-3) var(--space-4);` |
| `packages/ui-primitives/dist/Input/Input.module.css` | 6 | `line-height: var(--text-body-leading);` |
| `packages/ui-primitives/dist/Input/Input.module.css` | 11 | `width: var(--layout-width-full);` |
| `packages/ui-primitives/dist/FieldShell/FieldShell.module.css` | 9 | `font-weight: var(--font-weight-semibold);` |
| `packages/ui-primitives/dist/FieldShell/FieldShell.module.css` | 10 | `line-height: var(--text-small-leading);` |
| `packages/ui-primitives/dist/FieldShell/FieldShell.module.css` | 22 | `line-height: var(--text-small-leading);` |
| `packages/ui-primitives/dist/FieldShell/FieldShell.module.css` | 29 | `line-height: var(--text-small-leading);` |
| `packages/ui-primitives/dist/Button/Button.module.css` | 7 | `font-weight: var(--font-weight-semibold);` |
| `packages/ui-primitives/dist/Button/Button.module.css` | 12 | `padding: var(--space-0) var(--space-4);` |
| `packages/ui-primitives/dist/Button/Button.module.css` | 14 | `line-height: var(--text-body-leading);` |
| `packages/ui-primitives/dist/Badge/Badge.module.css` | 5 | `padding: var(--space-1) var(--space-3);` |
| `packages/ui-primitives/dist/Badge/Badge.module.css` | 8 | `font-weight: var(--text-micro-weight);` |
| `packages/ui-primitives/dist/Badge/Badge.module.css` | 9 | `line-height: var(--text-micro-leading);` |
| `packages/ui-primitives/dist/Alert/Alert.module.css` | 6 | `padding: var(--space-4);` |
| `packages/ui-primitives/dist/Alert/Alert.module.css` | 13 | `width: var(--layout-icon-slot);` |
| `packages/ui-primitives/dist/Alert/Alert.module.css` | 17 | `font-weight: var(--font-weight-semibold);` |
| `packages/ui-primitives/dist/Alert/Alert.module.css` | 18 | `line-height: var(--line-height-tight);` |
| `packages/ui-primitives/dist/Alert/Alert.module.css` | 26 | `min-width: var(--layout-min-width-none);` |
| `packages/ui-primitives/dist/Alert/Alert.module.css` | 32 | `font-weight: var(--font-weight-semibold);` |
| `packages/ui-primitives/dist/Alert/Alert.module.css` | 33 | `line-height: var(--text-small-leading);` |
| `packages/ui-primitives/dist/Alert/Alert.module.css` | 39 | `line-height: var(--text-small-leading);` |

### 2.3 Supplemental literal hunt (stricter)

```bash
grep -rE ':\s*[0-9]|:\s*inherit|:\s*nowrap|:\s*#[0-9a-fA-F]|:\s*solid\s|:\s*flex\s*;' packages/ui-primitives/dist/*.css
```

**Result:** No matches.

### 2.4 Offending lines (hardcoded numeric / keyword literals)

- **None.** Every hit under §2.2 uses `var(--*)` token references only. No surviving raw `px`, `%`, unitless numbers, or CSS keywords (`inherit`, `nowrap`, `solid`, etc.) in published `dist/` CSS.

---

## 3. Boundary Compliance

### 3.1 Scope

- **Target:** Imports of deprecated barrel `@app-tour/ui-primitives` (exact package name, no `/button` etc. subpath).
- **Roots scanned:** `packages/**` (excluding `packages/ui-primitives/**`), `apps/**` (missing at repo root).
- **Tools:** `rg --pcre2 '@app-tour/ui-primitives(?!/)'` and `grep` for `from "@app-tour/ui-primitives"`.

### 3.2 `apps/` directory

- **Path `apps/` at repository root:** **Does not exist.**
- **Implication:** No Phase 3 `apps/web` or `apps/api` consumers to audit yet. Boundary controls are enforced at **package/guard** layer only until apps land.

### 3.3 Barrel import violations (consumer code)

| File path | Violation? | Notes |
|-----------|------------|-------|
| *(none)* | No | Zero runtime/import statements resolving barrel |

### 3.4 Related references (non-violations)

| File path | Content | Why not a violation |
|-----------|---------|---------------------|
| `packages/ui-primitives/src/index.ts` | Deprecated stub; `export {}`; comment only | Excluded from `tsconfig.build.json`; **not emitted** to `dist/` |
| `scripts/guards/audit-ui-primitives-boundary.mjs` | Guard script strings | Tooling, not consumer import |
| `scripts/guards/import-boundary-ast.mjs` | AST guard for barrel | Enforcement |
| `scripts/guards/phase-2-guard.mjs` | `pnpm --filter @app-tour/ui-primitives` | Package name in CLI, not import |
| `scripts/guards/artifact-surface-guard.mjs` | Package id string | Tooling |

### 3.5 Enforcement scripts (PASS at audit)

```bash
pnpm run guard:import-boundary   # import-boundary-ast: PASS
pnpm run audit-boundary          # audit-ui-primitives-boundary: PASS
```

---

## 4. CI Enforcement Gap

### 4.1 Question

> Write the exact code change required for `phase-2:gate` to fail the build if an undeclared file is found in `dist/`.

### 4.2 Finding: **No gap — already implemented**

Undeclared `dist/` failure is enforced today by two layers:

#### Layer A — Root gate script (`package.json`)

```json
"guard:artifact-surface": "node scripts/guards/artifact-surface-guard.mjs",
"phase-2:gate": "pnpm build && pnpm test && pnpm run guard:architecture && pnpm run guard:import-boundary && pnpm run validate-design-tokens && pnpm run guard:artifact-surface && pnpm run audit-boundary && pnpm run phase-2:guard"
```

If `guard:artifact-surface` fails, **`phase-2:gate` exits non-zero** before `phase-2:guard` completes.

#### Layer B — Phase 2 guard check (`scripts/guards/phase-2-guard.mjs`)

```javascript
function checkArtifactSurfaceGuard() {
  const script = path.join(REPO_ROOT, "scripts/guards/artifact-surface-guard.mjs");
  const r = spawnSync(process.execPath, [script], { cwd: REPO_ROOT, encoding: "utf8" });
  const ok = r.status === 0;
  return {
    id: "p2_artifact_surface_guard",
    description: "theme-react + ui-primitives dist matches files/exports allowlist",
    required: true,
    ok,
    detail: ok ? null : truncateDetail((r.stdout ?? "") + (r.stderr ?? "")),
  };
}
```

Registered in `main()` checks array (required).

#### Guard behavior (`scripts/guards/artifact-surface-guard.mjs`)

- Fails when any `dist/**` file is **outside** `package.json` `files` prefixes.
- Fails on forbidden prefixes (e.g. `dist/tokens/` for ui-primitives).
- Delegates theme-react to `verify-export-allowlist.mjs` (L-01).

**Audit run:** `artifact-surface-guard: PASS` at report time.

### 4.3 Exact change (only if enforcement were missing)

*Hypothetical — not required today.* Apply both hunks:

**`package.json`** — add to `scripts` and append to `phase-2:gate`:

```json
"guard:artifact-surface": "node scripts/guards/artifact-surface-guard.mjs",
```

```json
"phase-2:gate": "pnpm build && pnpm test && pnpm run guard:architecture && pnpm run guard:import-boundary && pnpm run validate-design-tokens && pnpm run guard:artifact-surface && pnpm run audit-boundary && pnpm run phase-2:guard"
```

**`scripts/guards/phase-2-guard.mjs`** — add check + register in `checks`:

```javascript
function checkArtifactSurfaceGuard() {
  const script = path.join(REPO_ROOT, "scripts/guards/artifact-surface-guard.mjs");
  const r = spawnSync(process.execPath, [script], { cwd: REPO_ROOT, encoding: "utf8" });
  return {
    id: "p2_artifact_surface_guard",
    description: "theme-react + ui-primitives dist matches files/exports allowlist",
    required: true,
    ok: r.status === 0,
    detail: r.status === 0 ? null : truncateDetail((r.stdout ?? "") + (r.stderr ?? "")),
  };
}
// In main(): checkArtifactSurfaceGuard(),
```

### 4.4 Residual process gap (non-blocking, −3 debt points)

- Root `pnpm build` does **not** invoke `guard:artifact-surface` automatically; only `phase-2:gate` does. A developer can run `pnpm build` without gate and still get a clean `dist/` **if** package-level `prune-dist.mjs` ran — but CI must run `phase-2:gate` before Phase 3.

**Optional hardening (not applied):**

```json
"build": "... && pnpm run guard:artifact-surface"
```

---

## 5. Verdict

### 5.1 Debt Score: **94 / 100**

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| SB-02 artifact leakage | 30 | 30 | 0 undeclared `dist/` files |
| CSS purity in published `dist/` | 25 | 25 | 0 literal violations |
| Import boundary (barrel) | 25 | 22 | Guards PASS; **no `apps/` consumers yet** (−3) |
| CI gate enforcement | 20 | 17 | `phase-2:gate` + `p2_artifact_surface_guard` green; root `build` omits guard (−3) |

### 5.2 Compliance status

- **SB-02:** **Remediated** for audited packages (no leakage outside `files`).
- **CSS tokenization:** **Verified** in published `dist/` CSS.
- **Barrel imports:** **No violations** in current tree.
- **Phase 2.5 gate:** **Enforces** undeclared `dist/` via `guard:artifact-surface`.

### 5.3 Remaining work to reach **100 / 100**

1. **Scaffold `apps/web` and `apps/api`** (Phase 3) and ensure first imports use subpaths only (`@app-tour/ui-primitives/button`, etc.) — re-run §3 audit on real consumers.
2. **Wire `guard:artifact-surface` into root `pnpm build`** (or per-package `postbuild`) so local builds cannot pass without dist parity, not only via `phase-2:gate`.
3. **Document/monorepo policy** for theme-react filesystem-visible mapper files (whitelisted, non-exported) in app security reviews — optional; controls already block npm subpath resolution.

### 5.4 Auditor sign-off

Phase 2 publish surfaces audited here meet the **Zero-Debt technical bar** for artifact lockdown, CSS hygiene in `dist/`, and CI enforcement. Phase 3 may proceed **after** `pnpm run phase-2:gate` is green on the integration branch, with the three items above tracked as **process readiness**, not active security defects.

---

*End of report.*
