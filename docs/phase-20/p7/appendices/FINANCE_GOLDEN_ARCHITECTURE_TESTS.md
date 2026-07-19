# Finance golden architecture tests

```yaml
doc_id: FINANCE_GOLDEN_ARCHITECTURE_TESTS
version: "1.0"
date: "2026-07-19"
status: accepted
authority:
  - ADR-003 finance-core freeze
  - ADR-005 event neutrality
  - ADR-006 repository boundary
  - ADR-002 capability registry
  - FINANCE_HOSTILE_TENANT_ISOLATION
command: pnpm run guard:finance-golden
fail_build: true
```

## Purpose

Permanent, fail-closed checks that a **new engineer cannot accidentally violate** finance platform boundaries. Violations exit non-zero (CI / local guard red).

## Invariants

| ID | Invariant | Mechanism |
| -- | --------- | --------- |
| **G1** | No `apps/api` / `@apps/api` inside finance-core | `guard-boundary.mjs` + depcruise `finance-core-no-apps` |
| **G2** | No workspace imports into finance-core | boundary + depcruise `finance-core-no-workspaces` / `no-workspace-packages` |
| **G3** | No Prisma in finance-core | boundary + depcruise `finance-core-no-prisma` |
| **G4** | Repository boundary — core depends on `FinanceRepositoryPort` only | golden scan of `finance.service.ts` + core src |
| **G5** | Capability registration via generated bindings (no hand adapter Maps) | golden scan of dependency + reaction registries |
| **G6** | Tenant isolation — Prisma finance repo uses `withTenantRls` + `tenantId` | golden scan of `prisma-finance.repository.ts` |
| **G7** | Event neutrality — generic host finance runtime has zero workspace imports | golden scan (FIN-EVENT-NEUTRAL-01 file set) |

## Commands

```bash
# Fail-build golden suite (all G1–G7)
pnpm run guard:finance-golden

# Subset already used by CI path filter
pnpm run guard:finance-core-boundary
pnpm --filter @app-tour/finance-core run guard:boundary

# Spec mirror (node:test) — same assertions, readable failures
pnpm --filter @apps/api exec node --import tsx --test src/workspace-finance/finance-golden-architecture.spec.ts
```

## CI

Workflow [`.github/workflows/finance-golden-architecture.yml`](../../../.github/workflows/finance-golden-architecture.yml) runs on changes to:

- `packages/finance-core/**`
- `packages/finance-http-contracts/**`
- `apps/api/src/workspace-finance/**`
- golden guard script / this doc / dependency-cruiser config

## Non-goals

- Full RLS proof under concurrent tenants (covered by hostile isolation docs + integration suites)
- Product parity / opsManifest completeness (multi-product cert)
- Changing Option C or identity formulas

## Related

- [`FINANCE_PLATFORM_DEVELOPER_GUIDE.md`](./FINANCE_PLATFORM_DEVELOPER_GUIDE.md) §9–§10
- [`adr/INDEX.md`](./adr/INDEX.md)
