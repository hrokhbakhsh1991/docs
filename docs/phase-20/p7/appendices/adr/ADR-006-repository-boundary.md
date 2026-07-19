# ADR-006 — Finance repository port vs Prisma host

```yaml
adr_id: ADR-006
title: Repository boundary
status: Accepted
date: "2026-07-18"
supersedes: []
related:
  - FINANCE_PLATFORM_EVOLUTION_PLAN (1.21, 2.1, 2.2.1)
  - FINANCE_HOST_INTEGRATION_KIT
  - FINANCE_CORE_INTERNAL_FREEZE
  - ADR-001
```

## Status

Accepted.

## Context

Earlier “repository” surfaces leaked Prisma client shapes and concrete memory/Prisma unions into application code. Workspaces and core risked importing host persistence.

## Decision

1. `FinanceService` depends only on `FinanceRepositoryPort` (+ other ctor ports) and plain DTOs owned by finance-core / contracts.
2. Host `PrismaFinanceRepository` owns: `withTenantRls`, approve/prepay atomics (Option C / prepay UoW), ledger outbox persistence ordering, degraded booking-sync rows.
3. Transaction opacity: `FinanceTransactionPort`; Prisma types may appear only inside host adapters (Prisma repo, booking adapter, TX outbox writer).
4. finance-core **must not** import workspace packages or Prisma.
5. Workspace ledger/receipt/reaction adapters implement ports from **finance-http-contracts**, never import `apps/api`.
6. Composition root wires all required ports; partial stubs are unsupported for production.

## Consequences

- Option C and outbox durability semantics live in the **host** repository implementation, not in core.
- External hosts can replace Prisma with another SQL store if they honor the port + Option C order.
- Import-boundary / freeze guards enforce the split.

## Evidence

- [`../FINANCE_HOST_INTEGRATION_KIT.md`](../FINANCE_HOST_INTEGRATION_KIT.md) §4
- [`../FINANCE_CORE_INTERNAL_FREEZE.md`](../FINANCE_CORE_INTERNAL_FREEZE.md)
- `packages/finance-core/src/ports/finance-repository.port.ts`
- `apps/api/src/workspace-finance/infrastructure/prisma-finance.repository.ts`
