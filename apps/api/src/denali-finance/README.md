# denali-finance — tombstone

**Status:** removed (2026-07-18)

Parallel TypeScript adapters under this directory were a dead fork of
`apps/api/src/workspace-finance/` and are **not** wired into boot
(`lazy-finance-service.ts` → `workspace-finance` only).

Do **not** resurrect `FinanceService` / Prisma repositories here. All Denali
finance HTTP + domain mutations live in:

- Host: `apps/api/src/workspace-finance/`
- Routes: `@app-tour/finance-http` + `configure-finance-http-host.ts`
  (Denali ledger handlers remain under `@app-tour/workspace-denali/host/http`)

See: `docs/phase-20/p7/appendices/P7-FINANCE-PATH-BOUNDARY.md`.
