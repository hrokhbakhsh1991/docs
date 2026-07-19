# `@app-tour/finance-core`

Finance **application engine** for the app-tour platform. Host adapters, Prisma/RLS/outbox, and workspace packages stay **outside** this package.

**Status:** Stable internal platform package (`private: true`). Not published to a public registry.

## Ownership

| Owns | Does not own |
| ---- | ------------ |
| `FinanceService` / `createFinanceService` | Prisma, RLS, outbox writers/readers |
| Domain helpers (schedule, invoice compile, registration context) | HTTP route handlers |
| Application **ports** (repository, booking, ledger policy typing, host infra ports) | Workspace ledger/CoA/reaction **implementations** |
| Frozen public barrel (`src/index.ts`) | `apps/api` composition root |

**SoT packages**

- Engine: `@app-tour/finance-core` (this package)
- HTTP + workspace capability **contracts**: `@app-tour/finance-http-contracts`
- Host wiring: `apps/api` (`lazy-finance-service`, `HostFinance*`, Prisma repository)
- Workspace adapters: `packages/workspaces/*` via manifest + codegen

See also: [`FINANCE_HOST_INTEGRATION_KIT.md`](../../docs/phase-20/p7/appendices/FINANCE_HOST_INTEGRATION_KIT.md).

## Supported usage

```ts
import {
  createFinanceService,
  type FinanceRepositoryPort,
  type FinanceLedgerPolicyPort,
  // …other ports from the public API
} from "@app-tour/finance-core";

const finance = createFinanceService(
  ledgerPolicy,
  repository,
  bookingPayments,
  receiptDefaults,
  registrationDisplay,
  metrics,
  storageDriver,
  receiptProofStorage,
  capability,
  authorization,
  schedules,
  logger,
  clock
);
```

- Consume **built** `dist/` via package `exports` (`.`, `./ports`, `./domain`, `./application`).
- Implement all **13** constructor ports in the host (see Host Integration Kit).
- Preserve Option C approve atomicity in the **host** `FinanceRepositoryPort` (Paid → booking paid → Approved → outbox last).
- Node `>=24`.

## Forbidden dependencies / imports

Inside `src/` this package must **not** import:

- `@prisma/*` / Prisma client
- `apps/api` / `@apps/api`
- `@app-tour/workspace-*` / `packages/workspaces/*`
- `@app-tour/workspace-sdk` (use `FinanceActorContext` instead)
- `*.generated.*` bindings
- `node:fs` / `fs`
- `process.env`

Allowed: relative imports within the package, `node:crypto`, `@app-tour/finance-http-contracts`.

Enforced by `pnpm run guard:boundary`, `guard:portability`, `guard:public-api`.

## Scripts

```bash
pnpm -C packages/finance-core run build
pnpm -C packages/finance-core run test
pnpm -C packages/finance-core run guard:boundary
pnpm -C packages/finance-core run guard:portability
pnpm -C packages/finance-core run guard:public-api
```

## Versioning

`0.1.0` — pre-1.0 internal. Public API is allowlist-frozen; expanding exports requires an intentional semver decision. **Not published** in this phase.
