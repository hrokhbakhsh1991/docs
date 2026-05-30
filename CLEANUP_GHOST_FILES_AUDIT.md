# CLEANUP GHOST FILES AUDIT

Non-destructive inventory of compiled JavaScript artifacts across the monorepo after Phases 1–20 refactoring.

**Scan date:** 2026-05-30  
**Mode:** Read-only — no files deleted or modified  
**Scanner:** Python `os.walk` + `rg --files` verification

### Scan commands executed

```bash
# Primary source-tree walk (adjacent .ts/.js ghost detection)
python3 scripts/inline — walk apps/api/src, apps/api/test, packages/shared-contracts/src, packages/shared/src

# Ripgrep confirmation
rg --files -g '*.js' apps/api/src apps/api/test packages/shared-contracts/src packages/shared/src
rg --files -g '*.js.map' apps/api/src apps/api/test packages/shared-contracts/src packages/shared/src

# Repo-wide config / dist discovery (protected inventory only)
rg --files -g 'jest.config.*' -g 'eslint.config.*' -g '.eslintrc.*' -g 'vite.config.*' -g 'next.config.*' .
ls apps/api/dist/main.js
```

**Layout note:** `packages/shared/src/` does **not** exist in this workspace. The `@repo/shared` package stores TypeScript sources at `packages/shared/` root (`index.ts`, `rbac/`, `errors/`, etc.) with compiled output under `packages/shared/dist/` (production build — protected).

---

### 1. Summary Metrics

| Metric | Count |
|---|---|
| Total `.js` files found in source trees | **0** |
| Total `.js.map` files found in source trees | **0** |
| Adjacent ghost `.js` artifacts (same basename as `.ts`) | **0** |
| Adjacent ghost `.js.map` artifacts | **0** |

**Source trees scanned:**

| Path | Exists | `.js` | `.js.map` |
|---|---|---|---|
| `apps/api/src/` | Yes | 0 | 0 |
| `apps/api/test/` | Yes | 0 | 0 |
| `packages/shared-contracts/src/` | Yes | 0 | 0 |
| `packages/shared/src/` | **No** (package uses root-level TS) | — | — |

**Safety Verdict:** **PASS — no protected configuration files appear inside the source-tree leak paths.**  
All four scan targets are free of compiled JavaScript. Intentional configuration and build outputs live outside these trees (repo root, `dist/`, `.next/`, `storybook-static/`, etc.) and are catalogued in Section 3.

**Supplemental repo-wide observation (out of Section 2 scope):** The repository root contains ephemeral one-off refactor helper scripts (`fix_*.js`, `strip_relations*.js`, `update_*.js`) and legitimate tooling configs. These are **not** adjacent to TypeScript sources inside the mandated scan roots and are **not** classified as source-tree ghost artifacts here.

---

### 2. Isolated Ghost Artifact Inventory (Safe to delete later)

Criteria: a `.js` or `.js.map` file sitting **directly adjacent** to a `.ts`/`.tsx` file with the **exact same basename** inside:

- `apps/api/src/`
- `apps/api/test/`
- `packages/shared-contracts/src/`
- `packages/shared/src/`

**Result: none found.**

```
(no entries — source trees are clean)
```

If future scans find leaks, log them in this format:

```
- path/to/file.js (Adjacent to file.ts)
```

---

### 3. Protected Infrastructure Configuration Files (NEVER DELETE)

These files and directories are **allowlisted**. Any automated cleanup job MUST exclude them.

#### Root workspace orchestration

- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `nx.json`
- `.npmrc`
- `.nvmrc`
- `.editorconfig`
- `.gitignore`
- `.dockerignore`
- `.husky/` (Git hook scripts — do not delete)
- `scripts/` (CI, guardrails, k6, integrity gates — intentional `.js`/`.mjs` tooling)

#### Lint / test / commit tooling (root)

- `jest.config.cjs`
- `jest.config.precommit.cjs`
- `jest.pbt.config.js`
- `.eslintrc.cjs`
- `commitlint.config.js`
- `dependency-cruiser.config.js`
- `eslint-plugin-test-pairing/index.cjs`
- `eslint-rules/test-pairing-plugin.cjs`
- `packages/config/eslint.base.cjs`

#### App module roots

| App | Protected config / build entry |
|---|---|
| `apps/api/` | `jest.config.cjs`, `package.json`, **`dist/main.js`**, entire **`apps/api/dist/`** |
| `apps/web/` | `jest.config.cjs`, `jest.pbt.config.js`, `jest.styleMock.cjs`, `.eslintrc.json`, `next.config.mjs`, **`.next/`**, `storybook-static/` |
| `apps/telegram/` | `vite.config.ts`, `vite.config.js`, `vite.config.d.ts`, `package.json` |

#### Package module roots

| Package | Protected config / build entry |
|---|---|
| `packages/shared/` | `package.json`, `tsconfig.json`, entire **`packages/shared/dist/`** (e.g. `dist/index.js`, `dist/rbac/*.js`) |
| `packages/shared-contracts/` | `package.json`, `tsconfig.json`, entire **`packages/shared-contracts/dist/`** |
| `packages/ui/` | `.eslintrc.cjs`, `scripts/*.mjs` (tsx/css loader hooks) |
| `packages/config/` | `eslint.base.cjs` |

#### Production / CI build output directories (NEVER DELETE via ghost cleanup)

- `apps/api/dist/` — includes **`apps/api/dist/main.js`**
- `packages/shared/dist/`
- `packages/shared-contracts/dist/`
- `apps/web/.next/`
- `apps/web/storybook-static/` (contains bundled `.js` + `.js.map` Storybook artifacts)

#### Explicit naming allowlist (requested identifiers)

- `jest.config.js` — **not present**; equivalent protected files: `jest.config.cjs`, `jest.pbt.config.js`, `apps/api/jest.config.cjs`, `apps/web/jest.config.cjs`
- `eslint.config.js` — **not present**; equivalent protected files: `.eslintrc.cjs`, `apps/web/.eslintrc.json`, `packages/ui/.eslintrc.cjs`, `packages/config/eslint.base.cjs`
- `dist/main.js` — **present at** `apps/api/dist/main.js` (protected)
- Root-level framework orchestration: `pnpm-workspace.yaml`, `nx.json`, `dependency-cruiser.config.js`, `commitlint.config.js`

---

## Closing statement

The mandated TypeScript source trees (`apps/api/src/`, `apps/api/test/`, `packages/shared-contracts/src/`) contain **zero** stray `.js` or `.js.map` ghost artifacts adjacent to `.ts` sources. No destructive cleanup is required in those paths at this time. All compiled JavaScript that does exist is confined to intentional **dist**, **build**, **Storybook**, and **tooling configuration** locations documented above.
