# PROD-3 gate model

The machine-readable source of truth is [`PROD-3-GATE-CATALOG.json`](./PROD-3-GATE-CATALOG.json). `scripts/ops/run-gate-catalog.mjs` resolves dependency closure, detects cycles and duplicate IDs, executes nodes in catalog order, and writes structured JSON under `.artifacts/gates/`.
For long main/release certification runs, `--only` executes the requested
node(s) without dependency closure so previously proven expensive nodes do not
need to rerun during chunked evidence collection. Reports record whether
dependencies were included.

Public front doors are:

| Command | Tier | Meaning |
| --- | --- | --- |
| `pnpm run dev` | local | development processes |
| `pnpm run build` | local | artifact production |
| `pnpm run typecheck` | local | TypeScript/lint contract currently retained by repository policy |
| `pnpm run lint` | local | lint only |
| `pnpm run test` | local | deterministic package tests |
| `pnpm run verify:fast` | L0 | pre-commit budgeted checks |
| `pnpm run verify:pr` | L1 | path-aware PR checks |
| `pnpm run verify:main` | L2 | build-once main checks |
| `pnpm run release:verify` | L3 | release evidence gate |
| `pnpm run smoke:staging` | L4 | read-only deployed-artifact health smoke |
| `pnpm run smoke:production` | L5 | read-only post-deploy health smoke |

Compatibility aliases remain available during the migration window. The L3
workflow has the aggregate required job `Production readiness L3 release gate`;
the existing Phase 0/1 and Booking check names remain unchanged.

L1 uses the resolver-backed `test:changed:gate` path and does not silently
expand an app change into its entire package suite. L2 retains the full suite.
The canonical L2 integration node runs that full suite once, followed by the
architecture, import-boundary, phase-4, and API evolution guards; historical
phase-chain commands remain compatibility paths and are not nested by L2.
The L1/L2 budgets are 30/60 minutes; the former 15-minute L1 budget timed out
before the path-aware mode was enabled.
Workflow setup is centralized in `.github/actions/setup-platform`. Reports from
main/release catalog runs are uploaded as workflow artifacts. A missing staging
or production URL produces an explicit `SKIP`, never a production success claim.
