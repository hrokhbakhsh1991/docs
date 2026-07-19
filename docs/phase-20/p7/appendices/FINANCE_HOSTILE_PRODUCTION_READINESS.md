# Hostile production readiness audit — finance platform

```yaml
audit_id: FINANCE_HOSTILE_PRODUCTION_READINESS
version: "1.0"
date: "2026-07-19"
context:
  - finance remains in monorepo (extraction decision A)
  - platform boundary frozen (finance-core internal freeze READY)
scope: Denali offline_receipt finance on apps/api host
redesign: none
```

**Method:** Evidence from code, integration specs, and existing P7 staging docs only. Hostile = assume missing evidence is a gap, not “probably fine.”

---

## Scoreboard

| # | Area | Verdict |
| - | ---- | ------- |
| 1 | Runtime reliability | **PASS** |
| 2 | Operational readiness | **FAIL** |
| 3 | Workspace operations | **PASS** |
| 4 | Security | **PASS** |
| 5 | Testing confidence | **PASS** |

**Overall platform production claim (ops-complete):** **FAIL** — blocked by area 2 (alerts / observability depth).  
**Core money-path correctness claim (approve / prepay / idempotency / RLS):** **PASS** — areas 1, 4, 5.

---

## 1. Runtime reliability — PASS

### Evidence

| Concern | Evidence |
| ------- | -------- |
| Failure handling | Approve miss → `FINANCE_BOOKING_PAYMENT_SYNC_MISS` + full TX rollback (APPROVE-TX-*); conflict → `FINANCE_APPROVE_CONFLICT` + replay; capability fail-closed |
| Retries | HTTP idempotency reclaim (PAY-CREATE-RECLAIM-01, RECEIPT-SUBMIT-RECLAIM-01); prepay booking-sync retry endpoint + PREPAY-SYNC-RETRY-01; degraded persist retry loop (maxAttempts + backoff) in finance-core |
| Idempotency | Business keys + `HttpIdempotencyRecord`; APPROVE-IDEM-*, PREPAY-IDEM-*, PAY-CREATE-IDEM-*, RECEIPT-SUBMIT-IDEM-*; stable domainEventIds (no timestamps) |
| Transaction boundaries | Option C: Paid → `raisePaidInTx` → Approved → outbox last inside `withTenantRls`; APPROVE-TX-01..05 |
| Event processing recovery | `tryClaimWorkspaceFinanceProcessedEvent`; reaction `consumePendingForTenant`; prepay soft-fail + degraded outbox + retry |

### Issues

| Pri | Issue |
| --- | ----- |
| **P1** | Metrics almost unused in engine (only `finance_prepayment_booking_sync_degraded_persist_failed_total` evidenced) — failures may not be countable in prod |
| **P1** | TourCreated → finance reaction recovery covered by unit/ownership specs; **no** `finance-prepayments`/`finance-ops`-class HTTP integration named for relay drain failure/replay under load |
| **P2** | Memory repository is fail-closed simulation only — not production-equivalent (documented) |

---

## 2. Operational readiness — FAIL

### Evidence

| Concern | Evidence |
| ------- | -------- |
| Logging | `HostFinanceLogAdapter` → platform pino (`finance.host.*`); reaction failures → `workspace.finance.tour_created_failed` |
| Metrics | `HostFinanceMetricsAdapter` → `metricsRegistry`; **sparse** finance counters in application path |
| Tracing | **No** finance-path OpenTelemetry/span usage found under `workspace-finance` |
| Alerts | **No** finance-specific alert rules / runbook paging definitions found in repo evidence |
| Dashboards | Operator **UI** finance hub / KPI widget exist (product UX); **not** SRE dashboards for approve/ledger/outbox SLOs |

### Issues

| Pri | Issue |
| --- | ----- |
| **P0** | No evidenced **alerting** on approve failure, ledger enqueue failure, outbox backlog, or idempotency reclaim storms — cannot claim ops-ready production monitoring |
| **P1** | No distributed **tracing** on finance HTTP → TX → outbox path |
| **P1** | No SRE **dashboard**/SLO definitions for finance (latency, error rate, outbox lag) — only operator product widgets |
| **P2** | Log payload shape for financial events not normalized/redaction-reviewed in this audit |

**Why FAIL:** Hostile production requires detectability of money-path failures. Logging alone without alerts is insufficient.

---

## 3. Workspace operations — PASS

### Evidence

| Concern | Evidence |
| ------- | -------- |
| Adding new workspace | Manifest `workspaceFinance.supported` → codegen; proofs `finance-ws3`…`ws6` onboarding specs; gate has zero hardcoded id arrays |
| Disabling finance | `isFinanceModuleEnabled` → `FORBIDDEN_FINANCE_MODULE_DISABLED`; unsupported → `FINANCE_WORKSPACE_UNSUPPORTED` |
| Migration process | Host Prisma/RLS tables + finance delta SQL referenced by `finance-ops.spec.ts`; monorepo migrate path (platform-owned) |
| Rollback process | Module disable fail-closed (feature rollback without code revert); TX rollback proven for approve; schema rollback = standard DB migrate discipline (host) |

### Issues

| Pri | Issue |
| --- | ----- |
| **P1** | No single **finance-ops rollback runbook** (disable module + drain outbox + revert bad ledger) called out as one operator doc — pieces exist, not consolidated |
| **P2** | Architecture fixtures (`finance-ws2`, etc.) must not be treated as production tenants (documented) |
| **P2** | Production enablement still Denali-centric for real customers; multi-WS proofs are fixtures |

---

## 4. Security — PASS

### Evidence

| Concern | Evidence |
| ------- | -------- |
| Tenant isolation | Prisma paths use `withTenantRls`; RLS policies in finance-ops setup; APPROVE-IDEM-04 / PREPAY-IDEM-04 cross-tenant key isolation |
| Authorization boundaries | `FinanceAuthorizationPort` + capability gate; operator vs receipt-submit split; HTTP uses `resolveFinanceServiceForTenant` |
| Sensitive data exposure | Receipt proofs via **signed URL** adapter (time-limited object storage pattern); amounts as string minor units on API (intentional); engine has no Prisma leak |

### Issues

| Pri | Issue |
| --- | ----- |
| **P1** | No dedicated hostile test named for **cross-tenant receipt URL** / proof key enumeration in this audit’s file set (authz on review path exists; URL handler ownership not separately proven here) |
| **P1** | Financial fields may appear in structured logs (`finance.host.*` / reaction logs) — redaction policy not evidenced |
| **P2** | `FinanceActorContext` cast from `TenantAuthContext` in access adapter — structural; role mapping must stay correct |

---

## 5. Testing confidence — PASS

### Evidence

| Concern | Evidence |
| ------- | -------- |
| Integration depth | `finance-ops.spec.ts` (approve TX/idempotency/race/reclaim); `finance-prepayments.spec.ts` (idempotency, booking soft-fail, degraded, retry) — Postgres-gated |
| Staging | P7 exit checklist: VS-07, T3 finance-ops staging probe marked done (2026-06-23 evidence pack) |
| Boundary / multi-WS | finance-core 30 tests; ws3–ws6 onboarding; DI purity; outbox ownership |
| External composition | Hostile tarball sim + `external-finance-consumer` (memory adapters) |

### Issues

| Pri | Issue |
| --- | ----- |
| **P1** | `finance-ops` / `finance-prepayments` **skip** without `DATABASE_URL` — local/CI misconfig can green-wash |
| **P1** | Missing production scenarios: concurrent multi-instance approve under real relay lag; outbox poison-pill; signed-URL expiry abuse; non-Denali **customer** finance E2E |
| **P2** | Gateway/PSP payment mode out of P7 scope (documented blocked) — not a gap for offline_receipt claim |
| **P2** | External-consumer / memory paths are not Prisma-equivalent |

---

## P0 / P1 / P2 rollup (exact)

### P0 (must fix before ops-ready production claim)

1. Define and wire **alerts** for critical finance failures (at minimum: approve TX failure rate, ledger outbox enqueue/publish failure, outbox backlog / reaction claim failures).

### P1 (should fix before hostile launch confidence)

1. Expand **metrics** beyond degraded-persist-failed (approve, prepay, idempotency conflict, booking sync miss).  
2. Add **tracing** (or request-correlation) across finance HTTP → repository TX → outbox.  
3. SRE **dashboard**/SLO for finance paths (distinct from operator KPI widget).  
4. Consolidate **finance rollback / incident** runbook (module disable + outbox + ledger).  
5. Hostile **receipt URL / proof** cross-tenant test.  
6. Log **redaction** policy for amounts / storage keys.  
7. Ensure CI always runs Postgres finance-ops/prepay suites (or fail closed if DB missing in release pipelines).  
8. Integration coverage for **event relay** failure/recovery under durable outbox.

### P2 (acceptable / documented)

1. Memory driver ≠ prod.  
2. Fixture workspaces ≠ production tenants.  
3. PSP/gateway mode not in scope.  
4. External pack consumer is simulation-grade.  
5. Access adapter structural cast to `TenantAuthContext`.

---

## Explicit non-goals

- No architecture redesign  
- No payment/approve semantic changes  
- No extraction / publish cut (decision A stands)

---

## Related evidence

| Doc / suite | Role |
| ----------- | ---- |
| `apps/api/test/finance-ops.spec.ts` | Approve TX / idempotency |
| `apps/api/test/finance-prepayments.spec.ts` | Prepay + booking recovery |
| [`FINANCE_HOST_INTEGRATION_KIT.md`](./FINANCE_HOST_INTEGRATION_KIT.md) | Host contracts |
| [`FINANCE_CORE_EXTRACTION_DECISION.md`](./FINANCE_CORE_EXTRACTION_DECISION.md) | Stay monorepo |
| `docs/phase-20/p7/p7-exit-checklist.md` | Staging VS-07 / T3 |
