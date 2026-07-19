# Hostile tenant isolation audit — finance platform

```yaml
audit_id: FINANCE_HOSTILE_TENANT_ISOLATION
version: "1.0"
date: "2026-07-19"
scenario:
  workspace_types: 10
  tenants: 100
  shared: schema, repository singleton, booking adapter
redesign: none
```

**Method:** Code evidence from Prisma repository, RLS helper, booking adapter, enqueue, memory driver, composition cache. Hostile = treat single-layer defenses and missing filters as risks even when another layer usually covers them.

---

## Scoreboard

| # | Check | Verdict |
| - | ----- | ------- |
| 1 | Tenant RLS boundaries | **PASS** (prod Prisma path) |
| 2 | Repository queries | **PASS with defense-in-depth gaps** |
| 3 | Ledger isolation | **PASS** (tenant envelope + line assert) |
| 4 | Payment visibility | **PASS** (Prisma) |
| 5 | Prepayment visibility | **PASS** (Prisma) |
| 6 | Event routing isolation | **PASS** (tenant → type) |
| 7 | Cache / service resolution | **PASS** (no tenant state in cache) |

**Overall (production `STORAGE_DRIVER=prisma`):** isolation model is **tenant RLS + explicit `tenantId`**, not workspaceType. Suitable for 100 tenants × 10 types **if** RLS policies remain forced and request ALS aligns.

**Overall (memory driver):** **FAIL** for ledger list isolation — see P0.

---

## Scenario model

```text
100 tenants → each has workspaceType ∈ {10 types}
One process:
  financeServiceByWorkspaceType: Map (≤10 FinanceService)
  sharedFinanceRepository: 1
  sharedBookingPayments: 1
Shared tables: payments, payment_receipts, outbox, schedules, …
Isolation unit: tenantId (RLS session + where clauses)
```

WorkspaceType selects **policy adapters** only; it must **not** be required for row visibility (and is not used as a query filter).

---

## 1. Tenant RLS boundaries

### Evidence

| Mechanism | Location |
| --------- | -------- |
| Session vars on TX connection | `withTenantRls` → `applyTenantRlsSessionVars` |
| Empty tenant rejected | `TENANT_RLS_TENANT_ID_REQUIRED` |
| Request ALS vs RLS target | `assertActiveTenantMatchesRlsTarget` → `TENANT_RLS_ALS_TENANT_MISMATCH` |
| Policies (test/setup mirror) | `payments_tenant_isolation`, `payment_receipts_tenant_isolation` (`tenant_id = current_setting('app.current_tenant_id')`) |

### Risks

| Pri | Risk |
| --- | ---- |
| **P1** | Isolation **collapses** if FORCE RLS / policies missing on any finance table in an env (ops/migrate drift) — code still passes `tenantId` in many wheres, but updates-by-id rely on RLS |
| **P1** | Relay paths with ALS unset skip ALS mismatch check (documented no-op) — must pass correct explicit `tenantId` |
| **P2** | Connection pool reuse is mitigated by TX-scoped `set_config`; mis-implementation of session vars would be catastrophic (platform-owned, not finance-specific) |

---

## 2. Repository queries

### Evidence (Prisma) — typical pattern

Most reads/creates use **both**:

```text
withTenantRls(tenantId, tx => … where: { tenantId, … })
```

Examples: `getSummary`, `listOpenPayments`, `listPayments`, `listLedgerEvents`, `findPaymentById`, `listPendingReceipts`, `createManualPayment`, approve atomic guards.

### Missing / weak `tenantId` in `where` (hostile)

| Method | `where` | Coverage |
| ------ | ------- | -------- |
| `updateReceiptReview` | `{ id: receiptId }` only | Relies on RLS |
| `markPaymentPaid` | `{ id: paymentId }` only | Relies on RLS |
| `revertPaymentToPending` | `{ id: paymentId }` only | Relies on RLS |
| Booking `raisePaidInTx` update | `{ id: registrationId }` after `findFirst({ id, tenantId })` | Relies on RLS for update |

Approve path receipt update uses `{ id, tenantId }` (stronger).

### Memory driver

| Method | Issue |
| ------ | ----- |
| `listLedgerEvents` | **`void tenantId`** — returns global `ledgerEvents.slice` — **cross-tenant leak** |

### Risks

| Pri | Risk |
| --- | ---- |
| **P0** | Memory `listLedgerEvents` ignores tenant — any multi-tenant memory test/process sees all ledger rows |
| **P1** | Prisma updates keyed only by UUID — safe under FORCE RLS; **unsafe** if policy disabled or superuser role used on app path |
| **P2** | UUID primary keys reduce accidental cross-tenant update if IDs never collide; still not a substitute for `tenantId` in where |

---

## 3. Ledger isolation

### Evidence

| Control | Detail |
| ------- | ------ |
| Enqueue | `tenantId` on outbox envelope |
| Line scope | `assertLedgerLinesFinanceTenantScope` — line.tenantId must match envelope |
| List (Prisma) | `where: { tenantId, eventType: startsWith "finance.ledger." }` |
| Unique business ids | `@@unique(tenantId, domainEventId)` (Phase 3A/3B) — proven by IDEM-04 tests across tenants |

### Risks

| Pri | Risk |
| --- | ---- |
| **P0** | Memory list path (above) |
| **P1** | Workspace adapter could put **wrong tenantId inside lines** — rejected at enqueue (good); empty lines skip enqueue (domain issue, not cross-tenant) |
| **P2** | Two tenants can share the same payment UUID only if IDs collide — domainEventId `payment:{paymentId}:ledger-capture-anchor` is unique per tenant via outbox unique, not globally by paymentId string alone if IDs were ever duplicated across tenants |

---

## 4. Payment visibility

### Evidence

| Path | Filter |
| ---- | ------ |
| Lists / find / create | `tenantId` in where + RLS |
| HTTP | `auth.tenantId` from tenant kernel → service → repository |
| Cross-tenant idempotency | APPROVE-IDEM-04 / payment create keys scoped per tenant |

### Risks

| Pri | Risk |
| --- | ---- |
| **P1** | No `workspaceType` filter on payment lists — **correct**; leakage only if `auth.tenantId` wrong |
| **P2** | Shared booking adapter: registration lookup includes `tenantId` on find; update-by-id relies on RLS |

---

## 5. Prepayment visibility

### Evidence

| Path | Filter |
| ---- | ------ |
| `listPrepayments` | `where: { tenantId, eventType: finance.prepayment.recorded }` inside RLS |
| `recordPrepaymentAtomic` | tenant-scoped TX + domainEventId unique per tenant |
| PREPAY-IDEM-04 | Same key different tenants → no collision |

### Risks

| Pri | Risk |
| --- | ---- |
| **P1** | Prepayments stored as outbox payloads — visibility depends on outbox RLS; migrate drift on `outbox_events` policy is high impact |
| **P2** | Same registrationId string across tenants is OK if queries always include `tenantId` |

---

## 6. Event routing isolation

### Evidence

```text
processWorkspaceFinanceTourCreatedRow(row)
  → resolveFinanceWorkspaceTypeForTenant(row.tenantId)
  → resolveWorkspaceFinanceEventReaction(workspaceType)
  → reactToPublishedRow(row)

processWorkspaceFinanceOutboxForTenant(tenantId)
  → same resolve chain → consumePendingForTenant(tenantId)
```

| Property | Result |
| -------- | ------ |
| Routing key | **tenantId** (then workspaceType for adapter choice) |
| Cross-type mix | Tenant of type B never gets Denali reaction unless DB `workspace_type` wrong |
| Fail-closed | Unregistered type throws |

### Risks

| Pri | Risk |
| --- | ---- |
| **P0** | **Wrong `tenants.workspace_type`** → wrong ledger/reaction adapters for that tenant’s money (not cross-tenant row leak; **wrong policy / CoA**) |
| **P1** | Worker must not process another tenant’s outbox rows under tenant A’s RLS session |
| **P2** | Denali HostIo vs fixture reactions — asymmetry, not isolation bug |

---

## 7. Cache / service resolution

### Evidence

| Cache | Contents | Tenant state? |
| ----- | -------- | ------------- |
| `financeServiceByWorkspaceType` | ≤10 services | **No** — ports only |
| Shared repository / booking | Singletons | **No** ambient tenant; every call passes `tenantId` |
| Boot `resolveLazyFinanceService` | Denali (or env) service | Dangerous if used for HTTP (HTTP uses tenant resolve) |

### Wrong adapter selection

| Cause | Effect |
| ----- | ------ |
| Tenant row `workspace_type` incorrect | Service_B policies applied to tenant that should be A — **accounting/policy error**, rows still RLS-scoped to that tenant |
| First-create singleton booking | All types share same booking adapter (intentional) — not cross-tenant |
| Cache hit same type | Tenants 1 and 50 both denali share Service_A — **safe** (stateless) |

### Risks

| Pri | Risk |
| --- | ---- |
| **P1** | Ops mis-tag workspaceType = silent wrong CoA/ledger/reaction for that tenant |
| **P1** | Using boot/lazy finance service for authenticated multi-tenant HTTP would pin **Denali** adapters for all — architecture forbids; verify no regressing call sites |
| **P2** | Hot reload without process restart leaves stale adapter classes in the Map (all tenants of that type) |

---

## Cross-cutting: workspaceType leakage

| Question | Answer |
| -------- | ------ |
| Can workspaceType alone read another tenant’s payments? | **No** path found — queries use `tenantId` |
| Can listing “all denali finance” happen in repository? | **No** — no workspaceType query API on repository |
| Can Service_A’s ledger policy affect Tenant_B rows? | Only if Tenant_B’s type resolves to A — then policy applies to **B’s own** rows |

---

## P0 / P1 / P2 rollup

### P0

1. **In-memory** `listLedgerEvents` ignores `tenantId` — cross-tenant ledger visibility in memory mode.  
2. **Wrong tenant `workspace_type`** → wrong adapters (policy/reaction) for that tenant’s financial events (isolation of *rows* intact; isolation of *correct product rules* broken).

### P1

1. Several Prisma **updates by id only** — depend entirely on FORCE RLS.  
2. Booking `update` by registration id only inside TX — same.  
3. Outbox / payments RLS migrate drift.  
4. ALS unset on relay — discipline on explicit tenantId.  
5. Boot lazy finance path must never serve multi-tenant HTTP.  
6. No automated hostile suite named for “100 tenants concurrent RLS” beyond IDEM-04 style pairs.

### P2

1. Shared repository/booking singletons — OK with per-call tenantId.  
2. Service cache by workspaceType — OK if services stay stateless.  
3. UUID collision theory across tenants — low probability.

---

## Explicit non-findings (not redesign)

- Shared schema + shared repository is **compatible** with isolation when RLS + tenant filters hold.  
- Shared booking adapter is **compatible** when lookups include `tenantId`.  
- 10 workspace types do **not** require 10 databases for tenant isolation.

---

## Related evidence

| Artifact | Role |
| -------- | ---- |
| `with-tenant-rls.ts` / `assert-tenant-rls-alignment.ts` | RLS session + ALS |
| `prisma-finance.repository.ts` | Query filters |
| `in-memory-finance.repository.ts` | Memory leak in ledger list |
| `enqueue-finance-ledger-capture.ts` | Line tenant assert |
| `process-workspace-finance-outbox.ts` | Event routing |
| `lazy-finance-service.ts` | Service cache |
| `finance-ops` APPROVE-IDEM-04 / `finance-prepayments` PREPAY-IDEM-04 | Cross-tenant key tests |
