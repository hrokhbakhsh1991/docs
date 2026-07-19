# Hostile production-readiness audit — finance (HEAD runtime)

```yaml
audit_id: FINANCE_HOSTILE_PROD_READINESS_HEAD
version: "1.0"
date: "2026-07-19"
scope: HEAD runtime paths only
ignored: docs, intentions, architecture claims
paths:
  - packages/finance-core/src/application/finance.service.ts
  - apps/api/src/workspace-finance/infrastructure/prisma-finance.repository.ts
  - packages/finance-http/src/finance.routes.ts
  - apps/api/src/http/http-idempotency.ts
  - apps/api/src/db/with-tenant-rls.ts
  - apps/api/src/workspace-finance/enqueue-finance-ledger-capture.ts
```

## Score: **58 / 100**

| Area | Score | Weight intuition |
| ---- | ----: | ---------------- |
| Failure handling | 72 | Strong TX fail-closed; weak empty-ledger / sparse metrics |
| Idempotency | 85 | HTTP + business + reclaim proven in code |
| Concurrency | 80 | updateMany / P2002 / outbox unique |
| Observability | 28 | Almost no finance metrics; thin structured events |
| Recovery | 55 | Prepay degraded+retry; no general stuck-ledger tooling |

**Hostile summary:** Money-path **atomicity and idempotency are production-grade on Prisma**. Production **detectability and general recovery are not**.

---

## 1. Failure handling

### Database failure

| Runtime behavior | Evidence |
| ---------------- | -------- |
| Finance mutations run inside `withTenantRls` → `$transaction` | `prisma-finance.repository.ts` + `with-tenant-rls.ts` |
| Transient DB errors → circuit + `SERVICE_UNAVAILABLE` classification | `withTransientDbGuard` — **no in-TX retry** |
| Thrown error aborts transaction | Prisma TX semantics |

**Verdict:** Fail-closed. Partial commits inside one `withTenantRls` call do not survive thrown errors.

| Pri | Finding |
| --- | ------- |
| **P1** | No finance-specific metric/counter on DB failure — only generic transient/circuit plumbing |
| **P2** | Circuit open blocks all tenant DB — platform-wide, not finance-scoped |

### Outbox failure

| Runtime behavior | Evidence |
| ---------------- | -------- |
| Ledger enqueue is **last** step inside same approve/prepay TX | `approveManualReceiptAtomic` / `recordPrepaymentAtomic` |
| Duplicate `(tenantId, domainEventId)` → `false` → `FINANCE_APPROVE_CONFLICT` | `enqueueFinanceLedgerCaptureOutbox` + approve check |
| Insert error propagates → full TX rollback | Same TX |

**Verdict:** Outbox failure cannot leave Paid+Approved without ledger **when** `ledgerCapture.lines.length > 0`.

| Pri | Finding |
| --- | ------- |
| **P0** | `lines.length === 0` → enqueue skipped (`return true`) → **Paid/Approved with no ledger row** still commits |
| **P1** | No metric on enqueue false / conflict |

### Booking failure

| Path | Behavior |
| ---- | -------- |
| **Approve** `raisePaidInTx` | Catch → rethrow miss/failed → **TX rollback** (payment update not committed) |
| **Prepay** `trySyncBookingPaymentStatus` | **After** durable TX; soft-fail → warn log + degraded persist |

**Verdict:** Approve fail-closed; prepay intentionally durable-then-soft — correct split, but prepay depends on degraded path working.

| Pri | Finding |
| --- | ------- |
| **P1** | Degraded persist itself retries then metrics `finance_prepayment_booking_sync_degraded_persist_failed_total` — only finance metric found in engine |
| **P2** | Memory repo does not durable-degrade |

### Ledger adapter failure

| Runtime behavior | Evidence |
| ---------------- | -------- |
| `buildPaymentCaptureJournal` / `buildPrepaymentJournal` run **before** repository TX | `finance.service.ts` |
| Throw → no Paid/Approved mutation | Fail-closed |
| Bad plan (empty/unbalanced) accepted if no throw | No validation in core/host enqueue beyond tenant on lines |

| Pri | Finding |
| --- | ------- |
| **P0** | Empty/invalid plan without throw → durable money state without usable ledger (see outbox empty-lines) |
| **P1** | Adapter throw is opaque to metrics (uncaught → HTTP 500 only) |

### Receipt storage failure

| Runtime behavior | Evidence |
| ---------------- | -------- |
| `getReceiptUrl` catches `MINIO_NOT_CONFIGURED` / `RECEIPT_PROOF_KEY_SCOPE_INVALID` → **fallback internal URL** | `finance.service.ts` |
| Other storage errors rethrow | Same |
| Submit receipt persists `fileKey` only (upload is separate host path) | Repository `createReceipt` |

| Pri | Finding |
| --- | ------- |
| **P1** | Fallback URL may 404 later — operator sees success shape with broken proof access |
| **P2** | Scope-invalid treated as soft fallback (may hide mis-keyed objects) |

---

## 2. Idempotency

### Create payment

| Layer | Runtime |
| ----- | ------- |
| HTTP | `Idempotency-Key` **required**; `runIdempotentHttpMutation` |
| Service | SHA-256 key; find-before-create; payload mismatch → `FINANCE_PAYMENT_IDEMPOTENCY_CONFLICT` |
| DB | Unique + `P2002` race → re-read / conflict |

**Verdict:** Strong.

### Submit receipt

| Layer | Runtime |
| ----- | ------- |
| HTTP | Key **required** (`finance.routes.ts`) |
| Service | Optional hash in port; HTTP always passes key |
| DB | Idempotency unique + pending-receipt guard + `P2002` |

**Verdict:** Strong on HTTP path.

### Approve payment

| Layer | Runtime |
| ----- | ------- |
| HTTP | Key **required** when `decision=approve` |
| Service | Early replay if already Approved+Paid; conflict → re-read replay |
| DB | `updateMany` status Pending → count≠1 → `FINANCE_APPROVE_CONFLICT`; outbox dup → conflict |

**Verdict:** Strong.

### Event replay

| Mechanism | Runtime |
| --------- | ------- |
| Ledger `domainEventId` unique | Duplicate insert → not inserted / conflict |
| TourCreated processed claim | `tryClaimWorkspaceFinanceProcessedEvent` |
| HTTP lease reclaim | `reclaimStaleProcessingHttpIdempotencyRecords` + heartbeat |

| Pri | Finding |
| --- | ------- |
| **P1** | Ledger “replay” is uniqueness + conflict, not a dedicated replay API |
| **P2** | Reject path has no HTTP idempotency requirement (by code) |

---

## 3. Concurrency

### Two approve requests

| Mechanism | Runtime |
| --------- | ------- |
| Competing `updateMany` on Pending payment/receipt | Loser → `FINANCE_APPROVE_CONFLICT` |
| Service maps conflict → safe replay if winner committed | `reviewReceipt` catch |
| HTTP idempotency coalesces same key | `runIdempotentHttpMutation` |

**Verdict:** Handled.

### Two receipt submissions

| Mechanism | Runtime |
| --------- | ------- |
| Pending receipt exists → validation error | Prisma create path |
| Same idempotency key → conflict / replay | P2002 + service |

**Verdict:** Handled on Prisma path.

### Two ledger captures

| Mechanism | Runtime |
| --------- | ------- |
| Same capture `domainEventId` → outbox unique | Second insert false → approve conflict / prepay conflict paths |

**Verdict:** Handled — adapters emit stable ids; host rejects blank identities.

| Pri | Finding |
| --- | ------- |
| ~~**P0**~~ | ~~Unstable adapter `domainEventId`~~ — **remediated** (`FINANCE_ADAPTER_IDENTITY_STABILITY.md`) |

### Multi-workspace concurrent execution

| Mechanism | Runtime |
| --------- | ------- |
| Per-request `tenantId` + RLS TX | Isolation |
| Shared repository singleton | Stateless per call |
| Per-`workspaceType` `FinanceService` cache | Concurrent types OK |

| Pri | Finding |
| --- | ------- |
| **P2** | No finance-level lock across workspaces (not required if RLS holds) |

---

## 4. Observability

### Metrics

| Found in runtime | |
| ---------------- | |
| Engine `metrics.increment` | **One** name: `finance_prepayment_booking_sync_degraded_persist_failed_total` |
| Host adapter | Pass-through to `metricsRegistry` |
| Approve/prepay/outbox/idempotency finance counters | **Not found** under finance paths |

### Logs

| Found | |
| ----- | |
| `finance.booking_payment_sync.miss` / `.failed` | `logger.warn` via port |
| `finance.prepayment.booking_sync.degraded_persist_failed` | `logger.error` |
| Host wrapper | `finance.host.warn` / `.error` |
| Approve/outbox success/failure structured events | **Not found** in engine |

### Tracing / correlation

| Found | |
| ----- | |
| `getActiveTraceId()` applied into RLS session vars | `with-tenant-rls.ts` |
| Logger supports `correlation_id` from request context | platform `logger.ts` |
| Finance HTTP handlers adding workspaceType/tenant to spans | **Not found** in `finance.routes.ts` |

### Tenant / workspace visibility

| Found | |
| ----- | |
| Log payloads often include `tenantId` on booking-sync events | Engine |
| `workspaceType` on finance failure logs | **Not found** in engine warn/error payloads above |
| Metrics labels | `tenant_id` on the one counter only |

| Pri | Finding |
| --- | ------- |
| **P0** | No evidenced alerts/metrics for approve failure, ledger enqueue miss, or outbox lag — **cannot detect money-path failure in prod telemetry from finance code alone** |
| **P1** | No tracing spans around approve TX / outbox enqueue |
| **P1** | Failure logs omit `workspaceType` |
| **P2** | Host log wrapper may nest payload — searchable only if operators know `finance.host.*` |

---

## 5. Recovery

### Retry paths (code)

| Path | Exists? |
| ---- | ------- |
| HTTP idempotency reclaim + client retry | **Yes** (`http-idempotency-reclaim.ts`) |
| Approve conflict → automatic safe replay | **Yes** (service) |
| `POST /finance/prepayments/booking-sync-retry` | **Yes** (route ownership spec + service `retryPrepaymentBookingSync`) |
| `GET /finance/prepayments/booking-sync-degraded` | **Yes** |
| Retry failed outbox relay | Platform relay (not finance-specific tool in these files) |

### Stuck records

| Stuck shape | Runtime recovery |
| ----------- | ---------------- |
| Prepay durable, booking not partial | Degraded list + retry endpoint |
| Approved+Paid, missing ledger (empty lines / bug) | **No** dedicated repair API found |
| Processing idempotency lease stuck | Reclaim job/path |
| Outbox undelivered | Depends on platform relay — not inspected as finance module |

### Manual recovery tools

| Tool | Found? |
| ---- | ------ |
| Booking-sync degraded/retry HTTP | **Yes** |
| Admin “rebuild ledger from payment” | **Not found** |
| Finance module disable | Theme/gate (capability) — ops config, not a repair tool |

| Pri | Finding |
| --- | ------- |
| **P0** | No runtime tool to detect/repair **Paid without ledger** or **Approved without outbox** |
| **P1** | Recovery story is prepay-booking-centric; approve/ledger gaps are “retry HTTP” + DBA |
| **P2** | Test abort hooks (`P5_ATOMIC_TX_TEST_ABORT`) are not prod recovery |

---

## P0 / P1 / P2 rollup (HEAD only)

### P0

1. Empty `ledgerCapture.lines` → approve/prepay can commit **without** outbox ledger.  
2. No finance metrics/alerts on approve/ledger/outbox failure — **blind** to core money-path errors.  
3. No repair/detection path for stuck **Paid/Approved without ledger**.  
4. Unstable workspace `domainEventId` under concurrency → duplicate ledgers (idempotency of HTTP ≠ ledger identity).

### P1

1. Receipt URL soft-fallback on MinIO/scope errors masks storage outage.  
2. Only one finance metric (degraded persist failed).  
3. No spans / weak workspace visibility on failures.  
4. DB/outbox failures not finance-metered.  
5. Ledger adapter throws → bare 500, no finance counter.  
6. Approve/ledger recovery limited to conflict replay + reclaim — not operational runbook tooling in code.

### P2

1. Reject without HTTP idempotency key.  
2. Memory driver weaker than Prisma (not prod path).  
3. Platform circuit breaker is coarse.  
4. Multi-workspace concurrency relies entirely on RLS (acceptable if policies forced).

---

## Refactors

**None proposed.** Findings are evidenced runtime gaps; fixing them would be additive instrumentation/guards/tools, not an architecture redesign. Empty-lines behavior and missing metrics are the highest-leverage defects if a change were later approved.

---

## Score rationale

| + | − |
| - | - |
| Option C TX + conflict replay | Empty ledger lines commit |
| HTTP+DB idempotency + reclaim | Observability near-absent for approve/ledger |
| Prepay degraded + retry API | No Paid-without-ledger repair |
| P2002 / updateMany races | Adapter identity honor-system |

**58** = correct critical path, incomplete production operations.
