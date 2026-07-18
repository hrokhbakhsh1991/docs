# P7 — Finance code path boundary

```yaml
boundary_id: P7-FINANCE-PATH-BOUNDARY
pack_version: "1.6"
authority: PAYMENT-LEDGER-BOUNDARY.md · p7:gate
```

> Which finance module to edit during P7 — avoid fixing the wrong tree.

---

## Rule (normative)

| Path | P7 policy | Gate proof |
| ---- | --------- | ---------- |
| `apps/api/src/workspace-finance/` | **EDIT HERE** for P7 finance fixes | `finance-ops.spec.ts` · `p6:gate` |
| `apps/api/src/denali-finance/` | **TOMBSTONE (2026-07-18)** — TypeScript adapters removed; see `README.md` only. Do **not** resurrect parallel `FinanceService`. Runtime boot is `workspace-finance` via `lazy-finance-service.ts`. | `rg 'from .*denali-finance' apps/api/src` → 0 |

`createFinanceRepository()` in `workspace-finance/finance.repository.ts` selects Postgres vs memory via `STORAGE_DRIVER`.

---

## Staging requirement

```bash
STORAGE_DRIVER=prisma
DATABASE_URL=postgresql://...
```

Never enable `InMemoryFinanceRepository` on staging to "unblock" T3.

---

## VS mapping

| VS | Surface |
| -- | ------- |
| VS-05 | Portal receipt ingress → workspace finance receipts |
| VS-07 | Operator review → `PATCH /finance/receipts/{id}/review` + ledger outbox |

Runbook: [p7-receipt-minio-staging.md](../runbooks/p7-receipt-minio-staging.md)

---

## Phase 3A — `recordPrepayment` transaction + idempotency (normative)

```yaml
change_id: FINANCE-PREPAY-TX-IDEM-3A
date: "2026-07-18"
authority: Forensic Phase 2 F-01 · F-02
```

### Defects closed

| ID | Defect | Fix |
| -- | ------ | --- |
| F-01 | Ledger outbox TX then separate `finance.prepayment.recorded` TX | **One** `withTenantRls` via `FinanceRepository.recordPrepaymentAtomic` + `createTxScopedOutboxWriter` |
| F-02 | Business `domainEventId` included `recordedAt` → duplicate facts on retry | Stable identity from **HTTP `Idempotency-Key`** (not timestamp; not amount alone) |

### Client identity

- Header **`Idempotency-Key`** is **required** on `POST /finance/prepayments` (missing → **400** `IDEMPOTENCY_KEY_REQUIRED`).
- HTTP coalescing / response replay: existing `HttpIdempotencyRecord` + `runIdempotentHttpMutation` (same pattern as Urban registration / tours).
- Web BFF `apps/web/app/api/finance/prepayments` **must forward** `Idempotency-Key`.

### Durable business keys (tenant-scoped via `OutboxEvent @@unique([tenantId, domainEventId])`)

Let `keyHash = sha256(Idempotency-Key).hex[0..40]`.

| Event | `domainEventId` |
| ----- | --------------- |
| `finance.prepayment.recorded` | `prepayment:{registrationId}:{keyHash}` |
| `finance.ledger.double_entry_applied` | `prepayment:{registrationId}:{keyHash}:ledger` |

Journal/line stable UUIDs seed from `prepay:{registrationId}:{keyHash}` (not amount-only).

Same registration + same amount + **different** Idempotency-Key → **two** logical prepayments and **two** ledger identities.

### Transaction boundary

```text
BEGIN withTenantRls
  1. if prepayment outbox row exists for business domainEventId → return existing
  2. enqueue finance.ledger.double_entry_applied (tx-scoped writer)
  3. insert finance.prepayment.recorded
COMMIT
→ attempt booking paymentStatus=partial (outside TX; soft-fail + structured log; prepayment remains durable)
```

No new `finance_prepayment_operations` table. Memory driver remains `FINANCE_MEMORY_DRIVER_READ_ONLY_PREPAYMENT`.

### Proof

`apps/api/test/finance-prepayments.spec.ts` — PREPAY-IDEM-*, PREPAY-TX-*, PREPAY-BOOK-01, PREPAY-CONC-01.

---

## Phase 3B — `reviewReceipt(approve)` TX + HTTP idempotency (normative)

```yaml
change_id: FINANCE-APPROVE-TX-IDEM-3B
date: "2026-07-18"
authority: Forensic Phase 2 F-03 · F-04 · Step 0 recon
```

### Defects closed

| ID | Defect | Fix |
| -- | ------ | --- |
| F-03 | Approve lacked HTTP Idempotency-Key / response replay | Required `Idempotency-Key` on **approve** via `runIdempotentHttpMutation` |
| F-04 | Dual booking callback (`syncBookingPayment`) used by Memory, ignored by Prisma | Removed from atomic contract; Prisma raises booking inside `withTenantRls`; Memory uses injected `IBookingPaymentPort` on the fake only |

### Client identity (HTTP only)

- Header **`Idempotency-Key` required** when `decision=approve` on `PATCH /finance/receipts/{id}/review` (missing → **400** `IDEMPOTENCY_KEY_REQUIRED`).
- `decision=reject` does **not** require the header in 3B (unchanged reject path).
- Response replay: `HttpIdempotencyRecord` + `runIdempotentHttpMutation` (same host infra as Phase 3A prepayments).
- Web BFF must forward `Idempotency-Key` on approve.

### Durable ledger identity (unchanged)

| Event | `domainEventId` |
| ----- | --------------- |
| `finance.ledger.double_entry_applied` (capture) | `payment:{paymentId}:ledger-capture-anchor` |

**Not** derived from the client Idempotency-Key. Approve is a single payment/receipt state transition.

### Transaction boundary (Prisma = production SoT)

```text
BEGIN withTenantRls
  1. payment → Paid (+ paidAt, ledgerJournalId)
  2. OperatorRegistration.paymentStatus raise → paid (MISS → rollback)
  3. paymentReceipt → Approved
  4. enqueue finance.ledger.double_entry_applied (tx-scoped writer)
COMMIT
```

Test abort hooks (non-production): `P5_ATOMIC_TX_TEST_ABORT=finance_approve_after_payment|finance_approve_after_booking|finance_approve_after_receipt|finance_approve_before_commit`.

### Memory boundary (normative)

| Driver | Role |
| ------ | ---- |
| **Prisma** | Production source of truth — atomicity, concurrency, idempotency proofs |
| **Memory** | Unit-test fake only — **not** transactionally equivalent; must not run on staging |

Do not build a Memory transaction engine. Known fake limits may remain after smallest consistency fixes (e.g. orphan ledger cleanup on compensate).

### Proof

`apps/api/test/finance-ops.spec.ts` — APPROVE-IDEM-*, APPROVE-TX-* (requires `STORAGE_DRIVER=prisma` + `DATABASE_URL`).

---

## Phase 4A — minimal ledger policy extraction (normative)

```yaml
change_id: FINANCE-LEDGER-POLICY-PORT-4A
date: "2026-07-18"
authority: Phase 4A Step 0 boundary audit
```

### Goal

Remove host → Denali **ledger policy** hard imports from Finance application core while preserving Phase 3A/3B behavior.

### Target graph

```text
lazy-finance-service
  └── FinanceService
        ├── FinanceLedgerPolicyPort  ← DenaliFinanceLedgerPolicyAdapter
        └── FinanceRepository (*Atomic TX, host outbox writer)
```

### Rules

| Layer | Owns |
| ----- | ---- |
| Host (`workspace-finance`) | TX, RLS, Prisma, HTTP idempotency, booking projection, outbox enqueue |
| Workspace adapter | Chart of accounts, wallet id, `postDoubleEntryJournal`, emit payload shaping helpers used only inside adapter |
| Forbidden in `finance.service.ts` / `finance.repository.ts` | Direct import of `LEDGER_ACCOUNTS`, `bookingWalletId`, `postDoubleEntryJournal`, `emitFinanceLedgerDoubleEntryAppliedOutbox` |

### Non-goals (4A)

- No `packages/finance`
- No second workspace implementation
- No Phase 3A/3B identity or TX changes
- HTTP request DTO types may remain Denali-owned until a later phase

### Proof

Existing `finance-prepayments.spec.ts` (13) + `finance-ops.spec.ts` (15) remain green under `STORAGE_DRIVER=prisma`.

---

## Phase 4B — production hardening (normative)

```yaml
change_id: FINANCE-PROD-HARDENING-4B
date: "2026-07-18"
authority: Phase 4B inspection — H0/H1
amendment: FINANCE-PROD-HARDENING-4B-LEASE-IDEM
amendment_date: "2026-07-18"
```

### H0 — must fix before production

| ID | Defect | Fix |
| -- | ------ | --- |
| H0.1 | `HttpIdempotencyRecord` stuck in `processing` after crash (business may already be committed) | Lease-based reclaim: `leaseUntil` + `leaseOwner`; reclaim only expired leases (legacy NULL lease → `createdAt` TTL fallback); owner heartbeats; waiter re-claims after delete |
| H0.2 | Approve atomic path lacked in-TX `Pending` guards; silent ledger unique no-op | Conditional payment/receipt updates; required ledger insert must succeed or TX aborts |
| H0.3 | `P5_ATOMIC_TX_TEST_ABORT` active in any env | Abort hooks only when `NODE_ENV=test` (or test tier) |

#### H0.1 — HTTP idempotency lease (normative)

| Field | Role |
| ----- | ---- |
| `leaseOwner` | Opaque owner token (UUID) written on claim; heartbeats and complete/delete must match |
| `leaseUntil` | Absolute expiry; reclaim deletes `processing` only when `leaseUntil < now()` |

**Invariants**

- **I-LEASE-01:** A `processing` row with `leaseUntil >= now()` must not be reclaimed.
- **I-LEASE-02:** Owner extends `leaseUntil` while `execute()` runs (heartbeat); lost lease → no forged `completed` row.
- **I-LEASE-03:** Failure cleanup deletes only rows still owned by this `leaseOwner` (must not delete a successor owner).
- **I-LEASE-04:** After reclaim removes a key, waiter/client may re-claim (bounded retries) instead of a permanent 409 from a single null read.

**Env:** `HTTP_IDEMPOTENCY_PROCESSING_RECLAIM_MS` (default 120000) = lease duration and legacy `createdAt` fallback TTL.

**Stuck-key failure mode:** owner inserts `processing` + lease → business TX commits → process dies before `completed`. Lease expires → reclaim deletes → client retry. **Finance mutations must be business-idempotent** after reclaim.

**Approve already-Approved:** `reviewReceipt(approve)` returns the current approval DTO when receipt is already `Approved` and payment is `Paid` (non-destructive). Ledger identity remains `payment:{paymentId}:ledger-capture-anchor` (at most one capture).

#### Rollout compatibility (old + new pods)

| Phase | Behavior |
| ----- | -------- |
| Migration | Add nullable `lease_until` / `lease_owner`; backfill live `processing` rows to `lease_until = created_at + reclaim interval`, `lease_owner = 'legacy-backfill'` |
| New pods | Always set lease on claim; reclaim prefers `lease_until < now()` |
| Legacy rows (`lease_until IS NULL`) | Reclaim uses `created_at < now() - TTL` so old pods that omit lease fields still recover stuck keys |
| Mixed fleet | New reclaim never murders a heartbeating new owner; old-pod in-flight keys remain on createdAt TTL until those pods are upgraded |

Deploy order: **migrate schema → roll new API pods → drain old pods**. Do not reclaim-only-on-lease without the NULL/`createdAt` fallback while old writers exist.

### H1 — strongly recommended

| ID | Change |
| -- | ------ |
| H1.1 | Durable `finance.prepayment.booking_sync.degraded` + `…recovered`; list/retry APIs; **finance commit stays ahead of operational notification**; degraded persist uses bounded retries + metric/ERROR (never silent swallow) |
| H1.2 | `Idempotency-Key` on manual payment create + receipt submit **and** business unique keys so reclaim retries do not duplicate rows |

#### H1.2 — business creation idempotency (normative)

| Mutation | Durable key | Unique |
| -------- | ------------ | ------ |
| Manual payment create | `payments.creation_idempotency_key` = SHA-256 hex of HTTP Idempotency-Key | `@@unique([tenantId, creationIdempotencyKey])` (NULLs allowed for non-HTTP creates) |
| Receipt submit | `payment_receipts.idempotency_key_hash` = SHA-256 hex of HTTP Idempotency-Key | `@@unique([tenantId, idempotencyKeyHash])` |

**Invariants**

- **I-PAY-IDEM-01 / I-RCPT-IDEM-01:** Same tenant + same Idempotency-Key → at most one payment / receipt row for that logical create/submit.
- **I-HTTP-BIZ-01:** HTTP reclaim is safe because create/submit/prepay/approve are retry-safe at the business layer.
- Do **not** overload `providerPaymentId` for HTTP create identity.

#### H1.1 — degraded persist ordering

1. Prepayment atomic TX commits (money + outbox).
2. Best-effort booking sync runs **after** commit.
3. On sync failure: retry durable degraded outbox enqueue (bounded); on permanent failure emit metric + ERROR log; **do not** fail the HTTP prepay response and **do not** roll back finance.

### Non-goals (4B)

- No `packages/finance`, no second workspace, no Phase 3A/3B identity redesign
- No booking sync inside prepayment TX
- No full ledger reconciliation engine
- Memory remains unit-test fake only

## Phase 4B residual closure (post lease/idem remediation)

```yaml
change_id: FINANCE-PROD-HARDENING-4B-RESIDUAL
date: "2026-07-18"
authority: Hostile review leftovers after lease/idem remediation
```

| ID | Gap | Closure |
| -- | --- | ------- |
| H0.3-complete | `atomic-canonical-tour-persist` still read raw `P5_ATOMIC_TX_TEST_ABORT` | All abort hooks go through `shouldAbortAtomicTx` (NODE_ENV=test only) |
| IDEM-STATUS | Complete path always stored `status_code=201` | `runIdempotentHttpMutation` accepts optional `statusCode` (approve stores 200) |
| APPROVE-REPLAY-BOOKING | Replay hardcoded `bookingPaymentStatus: "paid"` | Replay reads booking projection via `IBookingPaymentPort.getPaymentStatus` (fallback `paid` only if row missing after Approved+Paid) |

### Proof (additional)

`ABORT-PROD-02` (canonical persist gated), `IDEM-LEASE-04` / `IDEM-LEASE-05`, `PAY-CREATE-CONCUR-01`, approve replay booking status assertion.

---

## References

- [PAYMENT-LEDGER-BOUNDARY.md](PAYMENT-LEDGER-BOUNDARY.md)
- [IMPLEMENTATION-TRUTH-P7.md](IMPLEMENTATION-TRUTH-P7.md)
