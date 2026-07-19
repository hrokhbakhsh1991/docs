# Changelog — `@app-tour/finance-core`

All notable changes to this package are documented here.  
Policy: [`docs/phase-20/p7/appendices/FINANCE_SEMVER_POLICY.md`](../../docs/phase-20/p7/appendices/FINANCE_SEMVER_POLICY.md).

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: [SemVer](https://semver.org/) as adapted for 0.x in the policy.

## [0.1.0] — 2026-07-19

### Stable (baseline)

- `createFinanceService` / `FinanceService` (13 required ports)
- Host ports: repository, booking, registration display, metrics, storage driver, proof URL, capability, authorization, schedules, logger, clock
- Ledger/receipt policy types re-exported from `@app-tour/finance-http-contracts`
- Domain helpers: invoice compile, schedules, registration context
- Identity helpers: `hashFinanceHttpIdempotencyKey`, `buildPrepaymentDomainEventIds`
- Package exports: `.`, `./ports`, `./domain`, `./application`
- Public API allowlist freeze (guard:public-api)

### Deprecated aliases (frozen; removal = major after 1.0)

- `AmbientTenantTx`, `FinanceTransaction`, `FinanceAccessPort`, `FinanceAuthzPort`, `FinanceLogPort`, `FinancePersistenceModePort`, `FinanceStoragePort`, `FinanceReceiptProofUrlPort`, `FinanceReceiptProofSignedUrlInput`

### Experimental (baseline)

- `FinanceTransactionPort` remains opaque `object` (branding may evolve without semantic change)

### Notes

- Depends on `@app-tour/finance-http-contracts` (`workspace:*` in monorepo; pack rewrites to `0.1.0`)
- `private: true` — not published; internal platform freeze only
- Versioning order: always release/bump **contracts before** core when both change
