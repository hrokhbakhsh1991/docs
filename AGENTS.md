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
pnpm run phase-2:gate   # phase 2 design-system gate (build, test, contracts, p2_* guards)
pnpm run test:contract            # KS-02/04: dist surface + no-legacy-imports (depcruise)
pnpm run phase-0:covenant-gate      # Phase 0 covenant (alias: phase-0:foundation-gate)
pnpm run phase-0:trunk-gate         # trunk integrity (alias: phase-0:integration-gate)
pnpm run phase-0:gate               # covenant-gate then trunk-gate
pnpm run pre-commit:fast            # same as Husky fast path (<60s target)
pnpm run guard:wrs-routing          # WRS-001 — no shop.* egress in app src
pnpm run guard:wrs-stale-docs       # WRS-001 — docs/playwright must not regress to shop.operator canonical
pnpm run guard:pcms-authority       # PCMS-001 — portal owns member session; marketing anonymous
pnpm run smoke:wrs-custom-apex      # Phase 5 — custom apex host bind (needs tenant_domains + API)
pnpm run seed:wrs-denali-club-domains  # dev seed denali.club + portal + admin.denali.club rows
pnpm run smoke:pcms-custom-apex      # PCMS — denali.club + portal + admin tenant-context smoke
pnpm --filter @apps/portal run test:smoke  # SMK-PTL-* portal E2E (incl. SMK-PTL-07 resume)
pnpm --filter @apps/portal run test:smoke:custom-apex  # SMK-PTL-08 custom apex E2E
pnpm run phase-9:guard              # Phase 9 doc pack — 32 charter gates
pnpm run guard:p9-boundary-diff     # Phase 9 PR boundary allowlist (9.1+)
pnpm run phase-10:guard             # Phase 10 host invariants + certification guard (fast)
pnpm run guard:workspace-certification  # Phase H CERT-04 proof matrix
pnpm run phase-i:fast-track            # Phase I guards (fast)
pnpm run phase-i:closure               # G+H regression + I1/I2 closure bundle
pnpm run phase-g-h:fast-track       # Phase G+H closure bundle before DEV→main PR
pnpm run generate:workspace-registry  # after workspace.manifest.json change
pnpm run workspace:create -- <id>   # scaffold packages/workspaces/<id>
pnpm run test:changed               # git-aware unit tests (origin/main...HEAD, cached)
pnpm run test:full                  # phase-3:gate + phase-4:gate (RLS when DATABASE_URL set)
pnpm run db:test-reset              # TRUNCATE tenant data — fast between integration runs
pnpm run ci:integrity               # phase-0→3 + phase-4 guard + evolution — CI / PR (not pre-commit)
pnpm run phase-7:adversarial-gate   # 7.8 P0 — prefer GHA workflow phase-7-gate (parallel jobs)
pnpm run phase-7:platform-gate      # 7.9 DoD — GHA job platform-dod after ci-integrity + adversarial green
pnpm run phase-3:gate               # apps/starter integration + doc-gate (inside ci:integrity / test:full)
pnpm run phase-4:gate               # full Phase 4 closure (includes phase-3:gate)
pnpm run check:node-engine  # Node 24 required (.nvmrc / engines)
pnpm run baseline:metrics
pnpm run doc-gate              # Docs-as-Code Doc-Gate (MAP §19) — required before Phase 3.1 merge
pnpm run phase-3:doc-scaffold  # alias for doc-gate
```

## Pre-commit (Husky)

After `pnpm install`, Husky runs **`pnpm run pre-commit:fast`** (eslint + prettier on diff, `test-changed` only). **Phase 9 velocity:** while [`docs/phase-9/appendices/PHASE-9-HOOKS-SUSPENSION.yaml`](docs/phase-9/appendices/PHASE-9-HOOKS-SUSPENSION.yaml) has `active: true`, pre-commit is a **no-op** until **subphase 9.8** — iterate on flow/UX; run `phase-9:guard` / targeted specs only when stabilizing a subphase. Full closure: **`pnpm run phase-9:gate`** at 9.8 (Architect YES). See [`docs/dev/tiered-testing.md`](docs/dev/tiered-testing.md). Hooks cannot be bypassed via `HUSKY=0` / `SKIP_HOOKS` (rejected). Detector: `bash scripts/phase-hooks-suspended.sh`. To reinstall hooks: `pnpm run prepare`.

## Migration plan

**Primary doc:** [`docs/MIGRATION-MAP.md`](docs/MIGRATION-MAP.md) — §5 infra, §6 events, §7 tenant routing, §8 plugin semver, §10 observability

**Phase execution (detailed):**

- Phase 0: [`docs/phase-0-foundation.md`](docs/phase-0-foundation.md)
- Phase 1: [`docs/phase-1-platform-core.md`](docs/phase-1-platform-core.md)
- Phase 2: [`docs/phase-2-design-system.md`](docs/phase-2-design-system.md)

Quick index: [`docs/MIGRATION.md`](docs/MIGRATION.md).

**Standards (routing + member session):**

- WRS-001: [`docs/standards/workspace-routing-standard.mdoc`](docs/standards/workspace-routing-standard.mdoc)
- PCMS-001: [`docs/standards/member-session-portal-authority.mdoc`](docs/standards/member-session-portal-authority.mdoc)
