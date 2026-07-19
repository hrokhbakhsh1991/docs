# Changelog — `@app-tour/finance-http-contracts`

All notable changes to this package are documented here.  
Policy: [`docs/phase-20/p7/appendices/FINANCE_SEMVER_POLICY.md`](../../docs/phase-20/p7/appendices/FINANCE_SEMVER_POLICY.md).

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: [SemVer](https://semver.org/) as adapted for 0.x in the policy.

## [0.1.0] — 2026-07-19

### Stable (baseline)

- HTTP Zod schemas + parsers: create payment, submit receipt, review receipt, record prepayment, generate schedule, list limits
- Workspace capability types: `FinanceLedgerPolicyPort`, `FinanceReceiptDefaultsPort`, journal/line/plan DTOs
- Package export: `.` only; dependency: `zod@^3.24.2`

### Experimental (baseline)

- `WorkspaceFinanceEventReactionPort` (+ `WorkspaceFinancePublishedOutboxRow`, `WorkspaceFinanceReactionBatchResult`)

### Notes

- `private: true` — not published; monorepo / pack-only until release YES
- Semver policy prepared; no registry cut in this version
