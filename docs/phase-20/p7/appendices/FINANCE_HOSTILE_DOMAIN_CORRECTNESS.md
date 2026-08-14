# Hostile finance domain correctness audit

```yaml
audit_id: FINANCE_HOSTILE_DOMAIN_CORRECTNESS
version: "1.0"
date: "2026-07-19"
focus: Can future workspace adapters change without breaking financial invariants?
formulas: unchanged (report only)
authority: finance-core · finance-http-contracts · Prisma host repository · P7-FINANCE-PATH-BOUNDARY
```

**Central question:** Workspace adapters own CoA / journal **materialization**. The engine owns lifecycle orchestration and (for prepay) **identity helpers**. Hostile finding: **adapters can silently break several money invariants** because the engine does **not** validate ledger plans.

---

## Scoreboard (invariants vs adapter blast radius)

| Lifecycle | Engine/host enforces | Adapter can break? |
| --------- | -------------------- | ------------------ |
| Payment create | Debt gate, idempotency payload match | Low (no ledger yet) |
| Receipt submit | Pending/Manual guards | Low (no ledger yet) |
| Approval + capture | Option C TX order; replay; conflict | **High** (journal shape / `domainEventId` / amounts) |
| Prepayment | Core identity helpers + atomic repo | **High** if adapter ignores passed ids / amounts |
| Idempotency / replay | HTTP + business keys (host+core) | Medium (wrong stable ids → false “new” facts) |
| Event ordering | Host TX order fixed | Low for approve/prepay paths; **High** for TourCreated reaction |

---

## 1. Payment lifecycle

### Normative flow (engine)

```text
gate → operator authz → hash Idempotency-Key
  → find by creationIdempotencyKey (replay if payload matches)
  → else debt gate (reject if Pending exists OR balanceDueMinor = 0;
       allow further Paid rows while remaining > 0 — PR20-D)
  → create Pending Manual payment
```

### Protected invariants

| Invariant | Enforcer |
| --------- | -------- |
| No second manual debt after settlement (`balanceDueMinor = 0`) | `assertManualPaymentDebtAllowed` (remaining-based; see `FINANCE_MANUAL_DEBT_PARTIAL_COLLECTION_POLICY.md`) |
| No parallel Pending manual debt | same gate |
| Partial collection (`remaining > 0` after Paid) allowed | PR20-D — Paid row alone is **not** settlement |
| Same key + different body → conflict | `FINANCE_PAYMENT_IDEMPOTENCY_CONFLICT` |
| Same key + same body → replay | Repository find-before-create |

### Adapter risk

| Pri | Risk |
| --- | ---- |
| **P2** | Workspace adapters are **not** on this path — low blast radius |
| **P1** | Host repository uniqueness / race still required; adapter cannot fix a broken host unique constraint |

---

## 2. Prepayment lifecycle

### Normative flow (engine)

```text
buildPrepaymentDomainEventIds(registrationId, Idempotency-Key)  // core — stable
  → ledgerPolicy.buildPrepaymentJournal({ …ids, amountMinor, … })
  → repository.recordPrepaymentAtomic(… lines + domainEventIds …)
  → booking sync partial OUTSIDE TX (soft-fail + degraded)
```

Core identity formulas (do not change — cited for audit only):

```text
prepaymentDomainEventId = prepayment:{registrationId}:{keyHash}
ledgerDomainEventId     = {prepaymentDomainEventId}:ledger
journalSeed             = prepay:{registrationId}:{keyHash}
```

### Protected invariants

| Invariant | Enforcer |
| --------- | -------- |
| Stable ids (no timestamp in business key) | `buildPrepaymentDomainEventIds` |
| Atomic ledger + prepayment recorded | Host `recordPrepaymentAtomic` |
| Booking miss does not unwind prepay | Soft-fail after commit |

### Adapter risk — **hostile**

| Pri | Risk | Why it breaks money |
| --- | ---- | ------------------- |
| **P0** | Adapter returns `domainEventId` ≠ `input.ledgerDomainEventId` | Duplicate ledger facts on retry, or collision with another key |
| **P0** | Adapter posts `amount_minor` ≠ `input.amountMinor` | Books wrong money while payment/prepay row stores client amount |
| **P0** | Unbalanced / single-sided / same-account lines | Invalid double-entry; engine **does not** call Denali `postDoubleEntryJournal` validators |
| **P1** | Non-deterministic `journalId` / line ids across retries | Replay inserts look like new journals if outbox unique misses |
| **P1** | Empty `lines[]` | Host enqueue treats empty as success no-op — durable prepay **without** ledger |

---

## 3. Receipt submission

### Normative flow

```text
gate → receipt-submit authz → payment must exist, Manual, Pending
  → createReceipt (optional idempotencyKeyHash)
```

Member path may auto-create Pending payment via receipt defaults (workspace **amount/currency only**).

### Protected invariants

| Invariant | Enforcer |
| --------- | -------- |
| No receipt on non-Pending / non-Manual | finance-core |
| Ownership for member path | `IBookingPaymentPort.memberOwnsRegistration` |

### Adapter risk

| Pri | Risk |
| --- | ---- |
| **P1** | `FinanceReceiptDefaultsPort` wrong defaults → member auto-payment wrong amount/currency (ingress only; still Pending until approve) |
| **P2** | Optional HTTP idempotency on submit → duplicate Pending receipts if client omits key (host/HTTP concern) |

---

## 4. Approval flow

### Normative order (Option C — host repository)

```text
Paid → raisePaidInTx(tx) → Approved → outbox ledgerCapture LAST
```

Engine builds plan via `ledgerPolicy.buildPaymentCaptureJournal`, then passes `ledgerCapture` only when `isDurablePersistence()`.

### Protected invariants

| Invariant | Enforcer |
| --------- | -------- |
| Atomic booking raise with payment/receipt | Host Prisma TX + booking port |
| Concurrent loser → conflict or safe replay | `FINANCE_APPROVE_CONFLICT` + Approved+Paid replay |
| Reject has no ledger / no booking raise | `updateReceiptReview` only |

### Adapter risk — **hostile**

| Pri | Risk | Why |
| --- | ---- | --- |
| **P0** | Capture `domainEventId` ≠ `payment:{paymentId}:ledger-capture-anchor` | Breaks frozen capture identity; retries/double capture behavior diverges from Phase 3B |
| **P0** | Plan amount/currency ≠ payment row | Ledger disagrees with Paid payment |
| **P0** | Empty lines on durable approve | Approve commits **without** ledger outbox (`lines.length === 0` → enqueue no-op true) |
| **P1** | Unbalanced journal | No engine-side balance check |
| **P2** | CoA account naming only | Allowed product variance — not an invariant break if balanced + correct amount + correct domainEventId |

---

## 5. Ledger capture

### What adapters own

`FinanceLedgerPolicyPort` → `FinanceLedgerCapturePlan` `{ journalId, domainEventId, lines[] }`.

### What host enqueue does

- Forces `eventType = finance.ledger.double_entry_applied`
- Asserts line `tenantId` scope
- Uses `capture.domainEventId` if non-empty; else **fallback** `finance.ledger:{registrationId}:{primary.idempotencyKey}`
- Truncates `domainEventId` to **128** chars

### Adapter / plan risks

| Pri | Risk |
| --- | ---- |
| **P0** | Empty override → **fallback id** (not capture-anchor formula) — silent identity drift |
| **P1** | Truncation could collide distinct long ids |
| **P1** | No validation that `lines[].amount_minor` sum(debit)=sum(credit) |
| **P1** | No validation `lines` reference `journalId` consistently (Denali helper checks; core does not) |
| **P2** | Metadata-only differences — OK |

---

## 6. Idempotency rules

| Surface | Key | Replay behavior |
| ------- | --- | --------------- |
| Create payment | HTTP key → SHA-256 `creationIdempotencyKey` | Same body replay; mismatch conflict |
| Submit receipt | Optional key hash | Host unique when present |
| Approve | HTTP `Idempotency-Key` (host) + business state | Approved+Paid non-destructive replay |
| Prepay | HTTP key → core domainEventIds + outbox unique | One logical prepay + one ledger id |

### Risks

| Pri | Risk |
| --- | ---- |
| ~~**P1**~~ | ~~Adapter unstable journal/line ids~~ — **remediated**: seeded UUIDs + fail-closed (`FINANCE_ADAPTER_IDENTITY_STABILITY.md`) |
| **P1** | Approve ledger id is payment-based, **not** HTTP key — correct by design; adapters must not encode HTTP key into capture `domainEventId` |
| **P2** | Receipt submit without key — duplicate Pending receipts possible |

---

## 7. Replay behavior

| Scenario | Expected | Break if adapter… |
| -------- | -------- | ----------------- |
| Approve after success | Return existing Approved+Paid | N/A (no new journal build used for early return) |
| Approve conflict then winner committed | Replay read path | N/A |
| Approve retry that rebuilds journal | Same `domainEventId` → outbox duplicate → `FINANCE_APPROVE_CONFLICT` or idempotent false insert | Uses new `domainEventId` each time → **second ledger** |
| Prepay retry | Same domainEventIds → atomic short-circuit | Ignores `ledgerDomainEventId` → second ledger |

| Pri | Risk |
| --- | ---- |
| **P0** | Non-stable capture/prepay `domainEventId` across identical business retries |

---

## 8. Event ordering

### Approve (durable) — fixed by host

```text
1 Payment Paid
2 Booking paid (same TX)
3 Receipt Approved
4 finance.ledger.double_entry_applied  (last)
```

Adapters cannot reorder this **unless** host repository is forked (out of workspace adapter scope).

### Prepay — fixed by host

```text
TX: ledger double_entry (+ prepayment.recorded) 
→ then booking partial (after commit, soft-fail)
```

### TourCreated → finance reaction — **workspace-owned**

| Pri | Risk |
| --- | ---- |
| **P0** | Reaction adapter can post arbitrary journals / skip claim / double-apply if `tryClaim` unused |
| **P1** | Ordering vs payment-capture events is not coordinated by finance-core — product must avoid conflicting wallets/accounts |
| **P2** | `requiresHostIo` cast hygiene — type risk, not money formula |

---

## 9. Can future workspace adapters change safely?

### Safe to change (product variance)

- Account codes / CoA labels  
- Wallet id encoding **if** still unique per registration and balanced  
- Journal metadata  
- Receipt default amount/currency (ingress)  
- Ops panel layout  
- Reaction **policy** only if claim+idempotent keys remain correct  

### Unsafe without breaking invariants (no engine guardrail)

| Change | Breaks |
| ------ | ------ |
| Capture `domainEventId` formula | Idempotent capture / Phase 3B identity |
| Prepay plan `domainEventId` ≠ core `ledgerDomainEventId` | Prepay ledger idempotency |
| Amounts ≠ payment/prepay input | Books ≠ cash intent |
| Unbalanced or empty lines | Invalid or missing ledger |
| Non-deterministic ids | Replay duplicates |
| Reaction without processed claim | Duplicate TourCreated ledgers |

### Honest answer

**No — not safely by type alone.**  
Future adapters **can** change CoA and still preserve invariants **only if** they obey undocumented-by-compiler rules:

1. Capture `domainEventId = payment:{paymentId}:ledger-capture-anchor`  
2. Prepay `domainEventId = input.ledgerDomainEventId`  
3. Balanced lines; amounts match inputs; stable journal/line ids  
4. Non-empty lines when durable persistence is on  
5. Reactions use processed-event claim + stable keys  

Those rules live in **docs + Denali/wsN examples**, not in finance-core validation.

---

## 10. Risk rollup (exact)

### P0

1. No engine validation of ledger plan balance / amount / capture-anchor / prepay id passthrough.  
2. Empty `lines` → durable approve/prepay can commit **without** ledger outbox.  
3. Wrong/omitted `domainEventId` → fallback or duplicate ledger identities.  
4. TourCreated reaction path can mint ledgers outside Option C guards.

### P1

1. No engine check that plan currency/amount match payment/prepay row.  
2. `domainEventId` 128-char truncation collision risk.  
3. Non-deterministic journal/line ids on retry.  
4. Optional receipt idempotency → duplicate Pending receipts.  
5. Receipt defaults wrong → wrong Pending debt (caught only at human review).  
6. Reaction vs capture ordering/account conflicts across events.

### P2

1. CoA naming differences across workspaces (expected).  
2. Metadata-only journal differences.  
3. Payment create path unaffected by ledger adapters.

---

## Explicit non-actions

- No formula changes  
- No code changes in this audit  
- No architecture redesign  

---

## Related SoT

| Doc / code | Role |
| ---------- | ---- |
| `packages/finance-core/.../finance.service.ts` | Lifecycle orchestration |
| `@app-tour/finance-http-contracts` `FinanceLedgerPolicyPort` | Adapter contract (unvalidated plans) |
| `enqueue-finance-ledger-capture.ts` | Outbox shape + empty-lines / fallback id |
| `P7-FINANCE-PATH-BOUNDARY.md` | Phase 3A/3B identities |
| Denali `post-double-entry-journal.ts` | Example validators **not** invoked by core |
