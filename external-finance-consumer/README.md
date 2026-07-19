# External finance-core consumer (Phase 2.3.4)

Second-repository simulation. **Not** part of the monorepo `pnpm-workspace.yaml`.

## Allowed dependencies

- `@app-tour/finance-core`
- `@app-tour/finance-http-contracts`

Linked via `file:` (stand-in for published semver). No `apps/api`, workspace packages, Prisma, or generated bindings.

## Setup

```bash
# From monorepo root — build publishable surfaces first
pnpm -C packages/finance-http-contracts run build
pnpm -C packages/finance-core run build

cd external-finance-consumer
# Stages dist + rewrites workspace:* → semver, then pnpm install --ignore-workspace
pnpm run prepare:local
pnpm run guard:imports
pnpm test
```

Do **not** run plain `pnpm install` from this directory without `--ignore-workspace`:
pnpm walks up to the monorepo workspace and the fixture stops being an external consumer.

## What it proves

Composition of `createFinanceService` with consumer-owned fakes:

- in-memory repository
- fake booking adapter
- fake ledger policy
- fake host ports (clock, authz, capability, storage, …)

Flows: create payment, prepayment, approve, ledger capture, idempotency.

## Blockers (honest second-repo cut)

| Blocker | Impact |
| ------- | ------ |
| `workspace:*` on finance-core → contracts | `file:` / `--ignore-workspace` install fails without staging rewrite |
| `private: true` on both packages | Cannot `npm publish` without a release cut |
| No registry publish | Fixture uses staged `.local-packages/` (publish-shaped), not npm |
| Dist required | Consumers need built `dist/` (`files: ["dist"]`); no `src` export |
| Host ports + repository not shipped | Second app must implement all 13 ctor ports + `FinanceRepositoryPort` |
| Parent workspace discovery | Without `--ignore-workspace`, pnpm attaches to monorepo |

**Host adoption checklist (pre-extraction):** [`docs/phase-20/p7/appendices/FINANCE_HOST_INTEGRATION_KIT.md`](../docs/phase-20/p7/appendices/FINANCE_HOST_INTEGRATION_KIT.md)
