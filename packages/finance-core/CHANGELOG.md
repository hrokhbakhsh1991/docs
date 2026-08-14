# Changelog — `@app-tour/finance-core`

All notable changes to this package are documented here.  
Policy: [`docs/phase-20/p7/appendices/FINANCE_SEMVER_POLICY.md`](../../docs/phase-20/p7/appendices/FINANCE_SEMVER_POLICY.md).

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: [SemVer](https://semver.org/) as adapted for 0.x in the policy.

## [Unreleased]

### Experimental (internal — not on public API)

- `src/case/` pure Case interpreter (`interpretFinanceCase`) — ephemeral `CaseOutput` only; no package export / no persistence
- `src/case/ports/` Case **read** fact provider contracts + fakes (PR2); separate from SoT workflow ports
- `src/case/assemble/` host-owned FactSnapshot orchestration (PR3); no interpretation; temporary until Case public export
- `src/case/execute/` Execution Layer (PR3.5); assemble → interpret + diagnostics; internal only
- `src/case/shadow/` Internal shadow observation (PR4.5-A); fail-isolated; no host flag/wiring
- **PR4-A Denali read adapters** live outside this package:
  `packages/workspaces/denali/src/finance/case-read/` + `apps/api/src/workspace-finance/case-read/`
  (structural portable facts; no `./case` public export; no host shadow wiring)
- Boundary doc: [`FINANCE_CASE_INTERPRETER_BOUNDARY.md`](../../docs/phase-20/p7/appendices/FINANCE_CASE_INTERPRETER_BOUNDARY.md)

### Added (PR4.5-B)

- Experimental package subpath **`@app-tour/finance-core/case`** (`exports["./case"]` → `src/case/public-api.ts`)
  - Host consumption: `executeFinanceCase`, `runShadowFinanceCase`, Case fact ports, portable facts, `CaseOutput` types
  - Not on package root; `rules/*` not exported
- Host DI: `apps/api/src/workspace-finance/case/` provider factory + optional shadow seam (`FINANCE_CASE_SHADOW_ENABLED`)

### Added (PR4.5-C)

- Live `HostDenaliCaseReadSource` over booking/finance/obligation repos (tenant-scoped)
- Observational Denali `FinanceService` wrap (post submit/review/payment + invoice read)
- `FinanceCaseObservationSink` diagnostics emitter (no Case persistence)

### Added (PR5-A)

- Host comparison engine: CaseOutput vs `OperationalObservation` (aligned / mismatch taxonomy / uncomparable)
- Sampling controls: tenant allowlist + sample rate (fail-open; no request blocking)
- Comparison observation emitter + in-memory metrics counters

### Fixed

- Public-api allowlist synced to obligation-override / schedule helpers already exported from root barrel

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
