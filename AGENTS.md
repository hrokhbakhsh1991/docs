# AGENTS.md — app-tour

## Layout

- **Root (`app-tour`)** — new platform; develop here.
- **`legacy/`** — frozen Tour Ops monorepo; reference only, no new features.

## Rules

1. `packages/workspace-sdk` and future `packages/platform-core` must not import from `packages/workspaces/*` or `legacy/`.
2. Workspace-specific code lives under `packages/workspaces/<name>/`.
3. Canonical document is the single source of truth for wizard state (no RHF mirror when UI lands).
4. Do not copy Denali paths into core before `platform-core` + `workspaces/starter` are green.

## Commands

```bash
nvm use && corepack enable
pnpm install
pnpm build && pnpm test && pnpm run guard:architecture && pnpm run guard:import-boundary
pnpm run phase-1:gate   # phase 1 full gate (recommended before PR)
pnpm run test:contract            # KS-02/04: dist surface + no-legacy-imports (depcruise)
pnpm run phase-0:foundation-gate  # Phase 0 closure: workspace-sdk + config + scoped guards
pnpm run phase-0:integration-gate   # trunk: full build + test + architecture + import-boundary
pnpm run phase-0:gate               # foundation-gate then integration-gate
pnpm run ci:integrity               # phase-0:gate + phase-1-guard delta — pre-commit via Husky
pnpm run check:node-engine  # Node 24 required (.nvmrc / engines)
pnpm run baseline:metrics
pnpm run doc-gate              # Docs-as-Code Doc-Gate (MAP §19) — required before Phase 3.1 merge
pnpm run phase-3:doc-scaffold  # alias for doc-gate
```

## Pre-commit (Husky)

After `pnpm install`, Husky runs `pnpm run ci:integrity` on every commit. Hooks cannot be bypassed (`HUSKY=0` / `SKIP_HOOKS` are rejected). To reinstall hooks: `pnpm run prepare`.

## Migration plan

**Primary doc:** [`docs/MIGRATION-MAP.md`](docs/MIGRATION-MAP.md) — §5 infra, §6 events, §7 tenant routing, §8 plugin semver, §10 observability

**Phase execution (detailed):**
- Phase 0: [`docs/phase-0-foundation.md`](docs/phase-0-foundation.md)
- Phase 1: [`docs/phase-1-platform-core.md`](docs/phase-1-platform-core.md)
- Phase 2: [`docs/phase-2-design-system.md`](docs/phase-2-design-system.md)

Quick index: [`docs/MIGRATION.md`](docs/MIGRATION.md).
