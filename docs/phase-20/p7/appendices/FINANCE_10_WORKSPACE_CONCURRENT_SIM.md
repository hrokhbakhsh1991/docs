# Architecture simulation — 10 finance workspaces concurrent

```yaml
report_id: FINANCE_10_WORKSPACE_CONCURRENT_SIM
version: "1.0"
date: "2026-07-19"
implementation: none
method: architecture trace against apps/api composition + generated registries
```

## Scenario

| Label | workspaceType | Distinct behavior |
| ----- | ------------- | ----------------- |
| **A** | `denali` | Production Denali ledger policy |
| **B** | e.g. `finance-ws3` | Different ledger / CoA rules |
| **C** | e.g. `finance-ws6` | Different receipt defaults (e.g. AUD/9900) |
| **D–J** | seven further registered finance types | Same composition pattern as B/C |

Assume all ten are `workspaceFinance.supported: true`, codegen-bound, and each has ≥1 live tenant. Requests and outbox ticks interleave in one API process.

---

## Composition shape (actual)

```text
HTTP (tenantId)
  → resolveFinanceWorkspaceTypeForTenant(tenantId)
  → financeServiceByWorkspaceType.get(workspaceType)   // Map cache
       │
       ├─ ledgerPolicy      ← per workspaceType (from generated deps)
       ├─ receiptDefaults   ← per workspaceType
       │
       └─ SHARED process singletons (first create wins):
            repository, bookingPayments, registrationDisplay,
            metrics, storageDriver, proofStorage,
            capability, authorization, schedules, logger, clock
```

Evidence: `apps/api/src/boot/lazy-finance-service.ts`.

---

## Evaluation matrix

### 1. Singleton sharing

| Singleton | Shared across A…J? | Implication |
| --------- | ------------------ | ----------- |
| `FinanceRepositoryPort` | **Yes** (one Prisma/memory instance) | Correct if isolation is **tenant RLS**, not workspaceType |
| `IBookingPaymentPort` | **Yes** (`BookingPaymentAdapter` for every type) | Assumes **one** booking projection model for all finance workspaces |
| Registration display | **Yes** | Same booking read model |
| Metrics / logger / clock / storage / proof / schedules / authz / capability | **Yes** | Host infrastructure — expected |
| `FinanceService` instance | **No** — one cached instance **per workspaceType** | A/B/C keep distinct ledger + receipt ports |

**Hidden assumption:** Booking (and therefore approve `raisePaidInTx`) is **platform-universal**. A tenth workspace cannot plug a different booking adapter via manifest today — registry always injects `createPlatformBookingPayments()`.

**First-create coupling:** Whichever workspaceType is composed first assigns `sharedBookingPayments` / `sharedFinanceRepository`. Today all types produce the same booking class, so order is harmless. If a future type ever returned a different booking factory, **the first winner would poison all others** (code still forces platform booking in `requireRegisteredFactories`, so this is latent only if that force is removed).

---

### 2. Cache isolation

| Cache | Key | Isolates A vs B vs C? |
| ----- | --- | --------------------- |
| `financeServiceByWorkspaceType` | `workspaceType` string | **Yes** for ledgerPolicy + receiptDefaults |
| Repository singleton | none | **No** workspace key — relies on `tenantId` in every call |
| Boot path `resolveLazyFinanceService` | boot type (default **`denali`**) | **Not** multi-WS safe for HTTP (HTTP must use tenant resolve) |

**Verdict:** Policy/defaults are cache-isolated by workspaceType. Persistence is **not** cache-isolated by workspaceType (by design: shared DB).

**Risk under 10 WS:** Stale service cache if codegen hot-reloads adapters without process restart — all ten keep old class instances until restart (no per-tenant invalidation).

---

### 3. Tenant resolution

```text
tenantId → tenants.workspace_type (+ theme)
        → must be in finance dependency registry
        → else FINANCE_WORKSPACE_UNSUPPORTED
```

| Property | Under 10 WS |
| -------- | ----------- |
| Per-request | Yes |
| Cross-tenant leak via wrong service | Low if `workspace_type` correct |
| Mis-tagged tenant | Tenant of type B calling with data expected for A — **ops error**, not engine mix-up of policies (engine uses B’s policy) |

**Hidden assumption:** Exactly one `workspaceType` per tenant; no multi-plugin tenant; finance does not resolve “which of 10” except via that column.

---

### 4. Capability registry

Generated bindings scale to N types:

- `WORKSPACE_FINANCE_BINDINGS` / `isFinanceSupportedWorkspace`
- Dependency + CoA + event reaction maps
- Nav plugin id set
- Ops bindings **only** for manifests with `opsManifest` (subset)

| Workspace | Capability | Ops panels |
| --------- | ---------- | ---------- |
| A Denali | supported + default module | Bound |
| B | supported | Depends on manifest |
| C (ws6-like) | supported | **Often unbound** → empty panels |

**Hidden assumption:** “Finance enabled” ≠ “ops UI complete”. Ten API-capable workspaces can still look like one Denali ops product in the admin shell.

---

### 5. Event routing

```text
outbox row / batch(tenantId)
  → resolveFinanceWorkspaceTypeForTenant
  → resolveWorkspaceFinanceEventReaction(workspaceType)
  → reactToPublishedRow / consumePendingForTenant
```

| Property | Under 10 WS |
| -------- | ----------- |
| Routing key | **tenantId → workspaceType** |
| Fail-closed | Unknown type throws |
| HostIo | Denali (`requiresHostIo: true`) vs fixtures (`false`) — **asymmetric** |

**Hidden assumptions:**

1. Relay/worker invokes finance processing **per tenant** (or per row with tenantId) — not “drain all Denali globally” without tenant context.  
2. Reaction semantics are per workspace; **no** cross-workspace event bus isolation beyond tenant RLS on outbox rows.  
3. One production path (Denali + HostIo) is richer than fixture reactions — ten “equal” workspaces is false operationally.

---

### 6. Repository isolation

| Layer | Isolation unit |
| ----- | -------------- |
| Schema | **Shared** payments / receipts / outbox / schedules / idempotency |
| Query/mutation | **`tenantId` + RLS** (`withTenantRls`) |
| workspaceType | **Not** a DB partition key |

Under 10 simultaneous workspaces:

- Tenant T_A (denali) and T_B (ws3) share tables; isolation = RLS.  
- Two tenants of the **same** workspaceType share one `FinanceService` cache entry — fine (stateless service + tenant-scoped repo calls).  
- **No** repository instance per workspaceType.

**Hidden assumption:** All finance workspaces agree on the **same** payment/receipt/outbox schema and Option C semantics. A workspace cannot bring alternate tables via adapter alone.

Memory driver: process-global in-memory maps — **unsafe** for multi-tenant concurrency pretence; production assumes Prisma.

---

## Simultaneous request sketch

```text
t0  TenantA (denali)     approve     → Service_A (Denali ledger) + shared Repo
t0  TenantB (ws3)        prepay      → Service_B (ws3 ledger)   + shared Repo
t0  TenantC (ws6)        member rcpt → Service_C (ws6 defaults) + shared Repo
t1  Outbox tick TenantB              → Reaction_B
t1  Outbox tick TenantA              → Reaction_A (HostIo)
```

| Concern | Outcome |
| ------- | ------- |
| Ledger rules mixed? | **No** — A/B policies on different service instances |
| Receipt defaults mixed? | **No** — C’s defaults only on Service_C |
| Booking adapter mixed? | **N/A** — single shared adapter |
| DB rows mixed? | **No** if RLS + tenantId correct; **Yes** if tenant mis-tagged |

---

## Hidden assumptions about “one production workspace”

These are the monorepo truths that a 10-WS simulation surfaces:

| # | Assumption | Evidence |
| - | ---------- | -------- |
| 1 | **Boot/default product is Denali** | `BOOT_FINANCE_WORKSPACE_TYPE = "denali"`; lazy boot path |
| 2 | **HTTP `/finance/*` registration is Denali-owned** (shared handlers) | Denali `httpRoutes` → `finance-http`; not per-WS route tables |
| 3 | **Booking projection is one platform adapter** | Registry forces `BookingPaymentAdapter` for all types |
| 4 | **One shared finance repository / schema** | Singleton + RLS |
| 5 | **Ops UX is Denali-complete; fixtures often incomplete** | Ops bindings subset; ws6 without `opsManifest` |
| 6 | **Event HostIo richness is Denali-first** | `requiresHostIo: true` only on production Denali pattern |
| 7 | **Production certification / customer traffic is Denali-centric** | Fixtures are architecture proofs, not equal prod tenants |
| 8 | **Cache key is workspaceType, not tenant** | Many tenants of Denali share Service_A |
| 9 | **Manual `apps/api` (and web) package.json deps** scale linearly with WS count | Human wire per package |
| 10 | **Ledger correctness is adapter honor-system** | No engine validation — 10 adapters = 10 blast radii |

---

## What works at 10 WS (architecture)

- Distinct **ledger** and **receipt defaults** per workspaceType (A vs B vs C).  
- Tenant → type → service selection on HTTP.  
- Capability / dependency / CoA / reaction **registries** are multi-key maps.  
- Event routing is tenant-scoped to the correct reaction port.  
- Data isolation model is **multi-tenant RLS**, not multi-schema.

## What does **not** scale as “10 equal production workspaces”

- Per-workspace **booking** strategy.  
- Per-workspace **repository** / DDL.  
- Per-workspace **HTTP** stack (shared finance-http).  
- Parity of **ops panels** and **HostIo** reactions.  
- Ops monitoring (platform gap) multiplied by 10 with no per-WS SRE split.  
- Zero-touch onboarding (api/web deps still human).

---

## Verdict

Running **10 finance workspaces simultaneously is architecturally supported** for:

`tenant isolation + per-type ledger/receipt policy + per-type event reaction`

It is **not** a simulation of 10 independent finance products. It is **one platform finance host** with **N policy plugins**, still centered on **Denali-shaped** HTTP, booking, schema, and boot defaults.

| Dimension | Multi-WS ready? |
| --------- | --------------- |
| Singleton sharing | Ready for shared host; **not** for divergent booking/repo |
| Cache isolation | Ready for policy/defaults; shared IO singletons |
| Tenant resolution | Ready |
| Capability registry | Ready |
| Event routing | Ready (tenant-keyed) |
| Repository isolation | Ready via **tenant RLS**, not workspaceType |

---

## Related

| Doc | Role |
| --- | ---- |
| [`FINANCE_PLATFORM_DEBT_AUDIT.md`](./FINANCE_PLATFORM_DEBT_AUDIT.md) | Shared singletons = P2 |
| [`FINANCE_WORKSPACE_ONBOARDING_LIFECYCLE.md`](./FINANCE_WORKSPACE_ONBOARDING_LIFECYCLE.md) | Per-WS human wire |
| [`FINANCE_HOSTILE_DOMAIN_CORRECTNESS.md`](./FINANCE_HOSTILE_DOMAIN_CORRECTNESS.md) | Adapter invariant risk × N |
