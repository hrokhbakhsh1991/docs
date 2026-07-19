# `@app-tour/finance-http-contracts`

Portable **wire + workspace capability** contracts for finance.

**Status:** `0.1.0`, `private: true` — not published. Semver policy prepared; no registry cut without product YES.

## Owns

- Zod HTTP request schemas / parsers (create payment, receipts, prepayment, schedule, list limits)
- Workspace capability ports: `FinanceLedgerPolicyPort`, `FinanceReceiptDefaultsPort`
- Ledger plan DTOs (`FinanceLedgerCapturePlan`, journal lines)
- Experimental: `WorkspaceFinanceEventReactionPort`

## Does not own

- `FinanceService` / host repository / Prisma / RLS / outbox writers (see `@app-tour/finance-core` + Host Integration Kit)

## Versioning

Contracts release **before** finance-core when both change.  
Policy: [`docs/phase-20/p7/appendices/FINANCE_SEMVER_POLICY.md`](../../docs/phase-20/p7/appendices/FINANCE_SEMVER_POLICY.md) · [`CHANGELOG.md`](./CHANGELOG.md)

## Dependency

Runtime: `zod@^3.24.2` only (no `workspace:*`).
