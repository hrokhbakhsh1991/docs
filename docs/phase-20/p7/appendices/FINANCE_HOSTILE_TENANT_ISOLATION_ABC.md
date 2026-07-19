# Hostile tenant isolation — A/B/C concurrent runtime

```yaml
audit_id: FINANCE_HOSTILE_TENANT_ISOLATION_ABC
version: "1.0"
date: "2026-07-19"
focus: runtime correctness (not architecture narrative)
scenario:
  TenantA: workspaceType=denali
  TenantB: workspaceType=finance-ws5
  TenantC: workspaceType=finance-ws6
  concurrent: create payment, approve, ledger capture, outbox processing, reports
```

## Verdict

**PASS for cross-tenant isolation on Prisma HTTP + outbox paths** — policies/adapters do not leak between A/B/C when `tenants.workspace_type` and request `tenantId` are correct.

**Conditional FAIL** only if: wrong `workspace_type` on a tenant row, RLS not forced, memory driver, or boot/lazy finance used instead of tenant resolve.

---

## Concurrent timeline (runtime)

```text
t0  A createPayment(authA)  → resolve(A)→ Service_denali  → repo.create(tenantA)
t0  B approve(authB)        → resolve(B)→ Service_ws5     → repo.approve(tenantB) + ws5 ledger plan
t0  C reports(authC)        → resolve(C)→ Service_ws6     → repo.getSummary(tenantC)
t1  outbox row tenantA      → reaction(denali HostIo)
t1  outbox batch tenantB    → reaction(ws5)
t1  outbox batch tenantC    → reaction(ws6)
```

Composition: `resolveFinanceServiceForTenant(tenantId)` → `workspaceType` → `financeServiceByWorkspaceType` Map (`lazy-finance-service.ts`).

---

## 1. Can policy leak between tenants?

| Mechanism | Runtime |
| --------- | ------- |
| Ledger / receipt ports | Bound **per** `FinanceService` at create time from `resolveFinanceWorkspaceDependencies(workspaceType)` |
| Request path | Always uses `auth.tenantId`; policy methods receive that tenant’s ids/amounts |

| Leak mode | Possible? |
| --------- | --------- |
| A’s approve uses ws6 CoA because C ran concurrently | **No** — A’s call stack holds `Service_denali.ledgerPolicy` |
| Shared repository swaps policy | **No** — repository does not select ledger policy; service does before TX |
| B’s receipt defaults applied to A member bootstrap | **No** — only `Service_*` for A’s type |

| Pri | Risk (runtime) |
| --- | --------------- |
| **P0** | DB says TenantA.`workspace_type=finance-ws6` → A correctly gets ws6 policy (not a leak; **wrong product rules** for that tenant) |
| **P1** | `resolveLazyFinanceService()` (boot denali) used for a B/C request → **wrong policy** for that request |

**Answer: No concurrent policy leak** between correctly tagged A/B/C.

---

## 2. Can cached `FinanceService` leak state?

| Fact | Evidence |
| ---- | -------- |
| Cache key | `workspaceType` string (≤1 instance per type) |
| Instance fields | `private readonly` ports only — **no** tenantId field, **no** request Map |
| Multi-tenant same type | Two denali tenants would share `Service_denali` — safe if ports stay stateless |

| Leak mode | Possible? |
| --------- | --------- |
| C’s paymentId left on Service_ws6 after A runs | **No** — no such field |
| Concurrent A+B mutate shared service fields | **No** mutable finance state on service |
| Shared `HostFinanceClockAdapter` / metrics | Process-global; not tenant row data |

| Pri | Risk |
| --- | ---- |
| **P2** | If a **workspace adapter** kept mutable per-tenant cache internally, sharing one adapter instance across tenants of that type could leak — Denali/ws5/ws6 ledger adapters are plan builders (pure); HostIo reaction may hold no cross-tenant cache in registry factory (new instance per `resolveWorkspaceFinanceEventReaction` call) |

**Answer: No tenant state leak via `FinanceService` cache** for current port implementations.

---

## 3. Can ledger adapters mix?

| Binding | A | B | C |
| ------- | - | - | - |
| Service cache entry | `denali` | `finance-ws5` | `finance-ws6` |
| `buildPaymentCaptureJournal` | Denali adapter | ws5 adapter | ws6 adapter |

Approve path: plan built on **that** service’s `ledgerPolicy`, then passed into shared repo TX as data — repo does not re-resolve adapter.

| Mix mode | Possible? |
| -------- | --------- |
| Interleaved threads swap adapter mid-approve | **No** — closure over `this.ledgerPolicy` |
| Outbox payload from A processed with C’s reaction books | **Only if** `row.tenantId` resolves to C’s type (data error) |

| Pri | Risk |
| --- | ---- |
| **P0** | Mis-tagged `workspace_type` → wrong adapter for that tenant’s captures/reactions |
| **P1** | Unstable `domainEventId` from adapter → duplicate ledgers **within** tenant (not cross-tenant mix) |

**Answer: Adapters do not mix across A/B/C under correct tenant→type resolve.**

---

## 4. Can events route incorrectly?

| Entry | Runtime |
| ----- | ------- |
| Single row | `processWorkspaceFinanceTourCreatedRow(row)` → `resolveFinanceWorkspaceTypeForTenant(row.tenantId)` → reaction for that type |
| Batch | `processWorkspaceFinanceOutboxForTenant(tenantId)` → same |

| Misroute | Possible? |
| -------- | --------- |
| A’s TourCreated consumed by ws6 reaction because C’s batch runs | **No** — batch is per `tenantId` |
| Row with `tenantId=A` but payload about B | Reaction keyed by **row.tenantId**; still A’s adapter — business confusion, not B’s RLS session |
| Missing type | `FINANCE_EVENT_REACTION_UNSUPPORTED` / workspace unsupported |

| Pri | Risk |
| --- | ---- |
| **P0** | Worker processes outbox under **wrong RLS tenant** (infra bug) → cross-tenant read/write |
| **P1** | `row.tenantId` forged/mismatched with aggregate — host must trust outbox writer |

**Answer: Routing is tenant-keyed; incorrect route requires bad tenantId/type data or broken RLS session — not concurrent Map races.**

---

## 5. Can repository isolation fail?

| Control | Runtime |
| ------- | ------- |
| Shared singleton repo | Yes — one Prisma adapter |
| Per call | `withTenantRls(tenantId, …)` + most `where: { tenantId, … }` |
| Reports | `getSummary` / `listPayments` / `listLedgerEvents` filter by `auth.tenantId` |
| Approve / capture | Same TX session vars for that tenant only |
| Cross-tenant idempotency | Keys unique per `(tenantId, …)` — IDEM-04 style tests exist (same type); applies equally to A vs B vs C |

| Failure mode | Risk |
| ------------ | ---- |
| Concurrent A approve + C report | Separate TXs / session vars — **OK** |
| `updateReceiptReview` / `markPaymentPaid` by id only | Relies on **FORCE RLS** — **P1** if policies off |
| Memory `listLedgerEvents` ignores tenant | **P0** on memory driver — not Prisma |

**Answer: On Prisma + FORCE RLS, repository isolation holds for concurrent A/B/C.** Isolation unit is **tenantId**, not workspaceType (correct).

---

## Operation-specific checks

| Operation | Cross-tenant leak? | Cross-type policy mix? |
| --------- | ------------------ | ---------------------- |
| Create payment | No (tenant-scoped create + idempotency) | N/A (no ledger yet) |
| Approve + ledger capture | No (RLS TX + plan from that service) | No (unless wrong type on tenant) |
| Outbox processing | No if invoked per tenantId/row.tenantId | Reaction matches resolved type |
| Reports | No (`getSummary(tenantId)` etc.) | N/A |

---

## Evidence gaps (hostile)

| Gap | Note |
| --- | ---- |
| No HEAD integration test that runs **denali + ws5 + ws6 tenants concurrently** in one suite | Cross-tenant tests are mostly **same** workspaceType (`denali`×2) |
| Isolation confidence for A/B/C is from **code path inspection** + same-type multi-tenant tests | Not from a literal three-type race harness |

---

## P0 / P1 / P2

### P0
1. Wrong `tenants.workspace_type` → wrong ledger/reaction for that tenant (not cross-tenant row leak).  
2. Memory `listLedgerEvents` cross-tenant (if memory used).  
3. Outbox worker with wrong RLS tenant session.

### P1
1. Boot/lazy Denali service used for B/C HTTP.  
2. Prisma updates-by-id depending solely on FORCE RLS.  
3. No automated concurrent denali/ws5/ws6 isolation suite.

### P2
1. Shared booking/repo singletons (safe with per-call tenantId).  
2. Multiple tenants sharing one `FinanceService` per type (stateless).

---

## Direct answers

| Question | Answer |
| -------- | ------ |
| 1. Policy leak between tenants? | **No** (concurrent), if type tags correct |
| 2. Cached FinanceService leak state? | **No** tenant state on service |
| 3. Ledger adapters mix? | **No** across A/B/C services |
| 4. Events route incorrectly? | **No** if `tenantId`→type correct |
| 5. Repository isolation fail? | **No** on Prisma+RLS; **yes** if RLS broken or memory ledger list |

**Runtime correctness for the stated scenario: PASS** with the P0/P1 caveats above.
