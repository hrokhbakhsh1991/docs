# Finance Platform Evolution Plan (temporary)

```yaml
doc_id: FINANCE_PLATFORM_EVOLUTION_PLAN
pack: P7
status: PHASE_0_ON_BRANCH
date: "2026-07-18"
authority: >
  Repository inspection + P7-FINANCE-PATH-BOUNDARY.md (Phase 3A/3B/4A) +
  PAYMENT-LEDGER-BOUNDARY.md + workspace.manifest codegen
implementation: >
  Phase 0 Ownership Enforcement lives on branch finance/phase-0-ownership-enforcement
  (policy resolver, receipt defaults port, Option C raisePaidInTx, phase-10 allowlist).
  Not complete until that branch is merged. Later phases still require Architect YES.
constraints:
  - no migrations in Phase 0
  - no package extraction yet
  - no Phase 3A/3B identity changes
  - no ledger rewrite / durable GL
  - no async booking migration (Option B)
  - preserve production approve + prepay correctness
```

> **Architecture plan + Phase 0 progress tracker.** Superseding path-boundary authority remains
> [P7-FINANCE-PATH-BOUNDARY.md](./P7-FINANCE-PATH-BOUNDARY.md)
> and [PAYMENT-LEDGER-BOUNDARY.md](./PAYMENT-LEDGER-BOUNDARY.md) (Option C wording landed with Phase 0).
> Phases 1+ remain planning until a nano-spec is accepted.

---

## 1. Current State Assessment

### 1.1 What is already production-grade

Verified in `apps/api/src/workspace-finance/` + Prisma + P7 proofs:

| Capability | Evidence |
| ---------- | -------- |
| Manual payment create + HTTP idempotency | `FinanceService.createManualPayment`; `creationIdempotencyKey`; `HttpIdempotencyRecord` |
| Receipt submit / operator review | `submitReceipt` / `reviewReceipt`; `PaymentReceipt` |
| **Phase 3B** approve TX (Prisma) | Single `withTenantRls`: Payment→Paid → booking `paymentStatus` raise → Receipt→Approved → ledger outbox; proofs in `finance-ops.spec.ts` |
| **Phase 3A** prepayment TX + stable IDs | `recordPrepaymentAtomic`; `prepayment:{registrationId}:{keyHash}` / `:ledger`; proofs in `finance-prepayments.spec.ts` |
| Installment schedules | `FinanceSchedule` + `finance-schedule-store.ts` |
| Invoice read model | `compile-invoice-balances.ts` + `load-registration-invoice-facts.ts` |
| Outbox + relay | `enqueueFinanceLedgerCaptureOutbox` / tx-scoped writer; `outbox_events`; relay publish |
| Tenant RLS | `withTenantRls` on finance mutations |
| Module gate | `assertFinanceWorkspaceGate` + `workspace-finance-bindings.generated.ts` |
| Ledger **policy port** (4A) | `FinanceLedgerPolicyPort` + `DenaliFinanceLedgerPolicyAdapter` |
| Booking **application** port (non-TX) | `IBookingPaymentPort` + `BookingPaymentAdapter` for sync / ownership / soft-fail prepay |

P7 path boundary: edit **`apps/api/src/workspace-finance/`** only; `apps/api/src/denali-finance/` is tombstone.

### 1.2 What is Denali-specific

| Area | Location | Nature |
| ---- | -------- | ------ |
| Chart of accounts / wallet id | `packages/workspaces/denali/src/finance/ledger-accounts.ts` | Workspace policy |
| Double-entry helper | `post-double-entry-journal.ts` | Workspace (usable as shared later) |
| Ledger policy adapter | `infrastructure/denali-finance-ledger-policy.adapter.ts` | Correct as Denali adapter; **incorrect as sole boot wiring** |
| HTTP routes | `packages/workspaces/denali/src/http/finance.routes.ts` (codegen handlerPackage) | Handlers still Denali-packaged; DTOs moved (**P1.4**) |
| HTTP request contracts | `@app-tour/finance-http-contracts`; Denali schemas re-export | **P1.4 Done** — finance-owned SoT |
| HTTP host naming | `configureDenaliFinanceHttpHost` / `getDenaliFinanceHttpHost` | Naming/ownership leak (handlers still Denali) |
| FinanceService DTO imports | `finance.service.ts` ← `@app-tour/finance-http-contracts` | **P1.4 Done** — no Denali HTTP import |
| Ops UI manifest | `finance-ops-manifest.ts`; web imports `@app-tour/workspace-denali/host/finance/manifest` | Workspace UI config owned by Denali |
| TourCreated → ledger side-effect | `workspace.manifest.json` `events[]` + `api-tour-created-adapter.ts` | Valid workspace event; Denali-only binding today |
| Finance support binding | Only Denali in `WORKSPACE_FINANCE_BINDINGS` | Manifest `workspaceFinance.supported` |
| Nav gate | **Phase 1.2:** `shouldShowFinanceNav` → `workspaceFinance.supported` codegen (`denali`); was wizard `extendedChrome` | Enablement ownership fixed; ops panels still Denali |
| Offline receipt defaults | `OFFLINE_RECEIPT_DEFAULT_* = IRR / 2500000` in `FinanceService` | Workspace defaults in host core |

### 1.3 What is reusable today (without copying Finance)

| Reusable as-is | Caveat |
| -------------- | ------ |
| `Payment` / `PaymentReceipt` / `FinanceSchedule` tables | Shared multi-tenant schema |
| `FinanceService` workflow logic | Blocked by Denali DTO import + hardcoded defaults + Denali policy at boot |
| `FinanceRepository` Prisma atomics | Booking write inside approve TX bypasses port |
| `compile-invoice-balances.ts` | Pure; defaults currency in facts layer lean IRR |
| Outbox writer/reader helpers | Platform |
| `FinanceLedgerPolicyPort` / `IBookingPaymentPort` contracts | Need registry + TX-aware booking seam |
| Manifest `workspaceFinance` + codegen | Enablement only; no policy loader yet |

**Config-only WS2 onboarding today: not possible.** Gate + Denali CoA + nav + defaults + HTTP ownership block it.

### 1.4 Current architecture boundaries

```text
HTTP /finance/*     ← Denali package (routes, schemas, host ports)
        ↓
apps/api boot       ← lazy-finance-service hardcodes DenaliFinanceLedgerPolicyAdapter
        ↓
FinanceService      ← Denali DTOs; ports for ledger + booking (partial)
        ↓
FinanceRepository   ← Prisma Payment/Receipt/Schedule/Outbox
                    ← ALSO mutates OperatorRegistration in approve TX ★
        ↓
Outbox → Relay → TourCreated Denali side-effect → more finance.ledger.* rows
```

| Layer | Intended owner | Actual |
| ----- | -------------- | ------ |
| Finance workflows | Host / future finance-core | `apps/api/src/workspace-finance` |
| HTTP contract | Finance | Denali http package |
| CoA / posting rules | Workspace | Denali (+ boot selects only Denali) |
| Booking `paymentStatus` | Bookings | Bookings **and** FinanceRepository |
| Outbox/relay | Platform | Platform (OK) |
| Ops nav / panels | Web + workspace financeOps | Denali manifest + wizard flag |

### 1.5 Current coupling graph (Finance ↔ Booking)

```text
FinanceService
  ├─ IBookingPaymentPort ──▶ BookingPaymentAdapter ──▶ BookingsRepository
  │     syncStatus / getPaymentStatus / memberOwnsRegistration
  ├─ loadFinanceRegistrationContextMap ──▶ getBookingsRepository().getByIds
  │     (tourId, tourTitle, guestLabel) — read-only display
  └─ approveManualReceiptAtomic
        └─ SAME withTenantRls TX:
              Payment Paid
              → OperatorRegistration.paymentStatus raise (direct Prisma) ★
              → Receipt Approved
              → finance.ledger.double_entry_applied

Payment.registrationId = UUID correlation (NO FK to OperatorRegistration)
Ledger credit account = booking:{registrationId} (Denali naming)
```

| Coupling | Class |
| -------- | ----- |
| Approve TX booking raise | **Essential** for current fail-closed product semantics |
| Direct `operatorRegistration` in FinanceRepository | **Wrong ownership** (should be Option C port-in-TX) |
| List tourTitle enrichment | Accidental |
| `financeBookingHref` → Bookings UI | Accidental |
| `registrationId` correlation | Essential identity (not Booking table dependency) |

---

## 2. Target Architecture

Derived from **existing** patterns: `workspace.manifest.json` + codegen, `packages/workspaces/<id>`, `apps/api` composition root, AGENTS.md (platform packages must not import workspaces). No parallel plugin runtime.

### 2.1 Logical modules

```text
┌──────────────────────────────────────────────────────────┐
│ workspace.manifest.json                                    │
│  workspaceFinance.supported                                │
│  + policyModule / defaultsModule / opsManifestModule (new) │
│  + events[] (existing)                                     │
└────────────────────────────┬─────────────────────────────┘
                             │ codegen
┌────────────────────────────▼─────────────────────────────┐
│ apps/api boot (composition root)                           │
│  resolveFinanceLedgerPolicy(workspaceType)                 │
│  resolveFinanceDefaults(workspaceType)                     │
│  inject BookingPaymentProjection (incl. TX-capable)        │
└────────────────────────────┬─────────────────────────────┘
                             │
     ┌───────────────────────┼───────────────────────┐
     ▼                       ▼                       ▼
┌─────────────┐    ┌─────────────────┐    ┌────────────────────┐
│ Workspace   │    │ Finance Core    │    │ Host infrastructure│
│ packages/   │───▶│ (stays in       │───▶│ Prisma / RLS /     │
│ workspaces/ │    │  workspace-     │    │ outbox / storage   │
│ <id>/finance│    │  finance until  │    │ Bookings adapter   │
│ CoA,policy, │    │  Phase 2)       │    └────────────────────┘
│ defaults,   │    │ Service, ports, │
│ events,ops  │    │ pure invoice,   │
└─────────────┘    │ HTTP contract   │
                   └─────────────────┘
```

### 2.2 Finance Core responsibilities

**Inside (shared engine):**

- Payment / receipt / schedule lifecycles
- Approval mechanics (Pending→Paid/Approved/Rejected)
- HTTP + business idempotency (preserve Phase 3A/3B keys)
- Prepayment atomic write + stable `domainEventId` construction
- Pure invoice calculation (`compileRegistrationInvoice`)
- Outbox enqueue helpers for `finance.*` event types
- Ports: ledger policy, booking payment projection, receipt defaults, outbox writer
- Workspace gate (`isFinanceSupportedWorkspace`)
- Neutral HTTP route handlers + request DTO ownership (move off Denali when phased)

**Outside:**

- Chart of accounts, wallet account naming, posting recipes
- Currency / offline receipt defaults
- `financeOps` panel manifests
- Workspace-specific domain events (e.g. TourCreated)
- `OperatorRegistration` / `BookingsRepository`
- Durable GL / tax / FX / period close (Phase 3)
- Prisma schema ownership stays in `apps/api`

### 2.3 Workspace-owned

| Concern | Mechanism |
| ------- | --------- |
| Chart of Accounts | Workspace `ledger-accounts` (+ policy adapter) |
| Ledger posting policies | `FinanceLedgerPolicyPort` implementation per workspace |
| Currency / receipt defaults | Defaults module / theme + typed defaults port |
| Receipt policies (future) | Defaults first; workflow forks only when proven |
| Workspace events | Existing `events[]` + `hostSideEffect` codegen |
| Finance UI ops manifest | Workspace `finance-ops-manifest`; web imports via codegen/shared type |

**Shared FinanceService initially** — do not fork per workspace until a second concrete workflow exists.

### 2.4 Booking — Option C (normative for this plan)

| Rule | Detail |
| ---- | ------ |
| Keep | Approve atomicity: missing booking → `FINANCE_BOOKING_PAYMENT_SYNC_MISS` → full TX rollback |
| Keep | Prepay booking sync **outside** TX, soft-fail + degraded outbox (Phase 3A) |
| Change | FinanceRepository must **not** import `raiseBookingPaymentStatus` or call `tx.operatorRegistration.*` |
| Change | Inject **TX-participating** `BookingPaymentProjection` (extend or sibling of `IBookingPaymentPort`) with `raiseInTx(tx, …)` used inside `approveManualReceiptAtomic` |
| Forbid | Option B (async event → Booking projects) without explicit product YES |
| Forbid | Removing fail-closed approve semantics |

This matches the spirit of PAYMENT-LEDGER-BOUNDARY (Prisma atomicity > out-of-band port) while fixing ownership: Bookings adapter owns the Prisma mutation; Finance only calls the port.

### 2.5 Ledger — hybrid (normative for this plan)

| Now | Later (Phase 3) |
| --- | ---------------- |
| `finance.ledger.double_entry_applied` outbox JSON = **integration fact** | Durable `LedgerJournal` / `LedgerLine` tables + projector |
| UI `listLedgerEvents` may read outbox | UI reads journal tables |
| Policy builds balanced in-memory lines | Same policy; persistence changes |
| **Do not** call this a full GL | Trial balance / period close only after durable journal |

Preserve capture `domainEventId` = `payment:{paymentId}:ledger-capture-anchor` and Phase 3A prepay ledger ids.

### 2.6 Plugin / composition contract (manifest-native)

Extend existing `workspaceFinance` (do not invent a second host):

```text
workspaceFinance:
  supported: true
  defaultModuleEnabledWhenUnset: true
  policyModule / export     → FinanceLedgerPolicyPort factory
  defaultsModule / export   → receipt/currency defaults
  opsManifestModule / export → FinanceOpsManifest
```

Codegen targets (future implementation):

- `WORKSPACE_FINANCE_BINDINGS` (exists)
- Policy / defaults loaders (new)
- `WORKSPACE_FINANCE_NAV_PLUGIN_IDS` (replace wizard `extendedChrome` finance gate)

Boot: `resolveLazyFinanceService` selects policy + defaults by tenant `workspaceType`.

---

## 3. Migration Roadmap

### Phase 0 — Composition cleanup

| | |
| -- | -- |
| **Goal** | Stop lying in composition: policy selection, receipt defaults port, Option C booking TX port, allowlist honesty — **without** behavior change for Denali |
| **Status (2026-07-18)** | **On branch** `finance/phase-0-ownership-enforcement` — not merge-complete until PR lands |
| **Files affected** | `resolve-finance-ledger-policy.ts`; `lazy-finance-service.ts`; `ports/finance-receipt-defaults.port.ts` + Denali adapter; `ports/booking-payment.port.ts` (`raisePaidInTx`); `booking-payment.adapter.ts`; `finance.repository.ts` / factory; `scripts/guards/phase-10-guard.mjs`; PAYMENT-LEDGER-BOUNDARY |
| **Risks** | Accidental policy null for Denali tenants; approve TX regression; guard CI red if allowlist updated wrong |
| **Rollback** | Revert commit; Denali adapter remains default fallback |
| **Tests required** | `finance-ops.spec.ts` APPROVE-TX-* / APPROVE-IDEM-* (Prisma); `finance.service.spec.ts` FIN-SVC-*; phase-10 guard |
| **Must NOT** | Extract `packages/finance-core`; change Phase 3A/3B ids; add journal tables; touch approve TX order/semantics; onboard WS2 |

**Phase 0 checklist (Ownership Enforcement):**

| Item | State |
| ---- | ----- |
| Boot calls `resolveFinanceLedgerPolicy()` — no inline `new DenaliFinanceLedgerPolicyAdapter()` at call site | Done |
| Offline receipt amount/currency via `FinanceReceiptDefaultsPort` (Denali adapter keeps IRR / 2500000) | Done |
| `IBookingPaymentPort.raisePaidInTx` + adapter owns `operatorRegistration` mutate | Done |
| `FinanceRepository.approveManualReceiptAtomic` uses port only (zero booking Prisma imports) | Done |
| Same booking port instance injected into service + repository at boot | Done |
| phase-10 allowlist includes `ports/`, `infrastructure/`, known host files | Done |
| PAYMENT-LEDGER-BOUNDARY documents Option C | Done |

Manifest-driven **enablement** already exists; Phase 1 owns multi-workspace policy registry + HTTP/nav extraction.

### Phase 1.2 — Finance capability enablement boundary

| | |
| -- | -- |
| **Goal** | Finance hub / route visibility owned by finance capability codegen — **not** wizard chrome |
| **Before** | `pluginId` → `isExtendedOperatorWorkspace` (`wizardCreate.extendedChrome`) → finance nav |
| **After** | `pluginId` → `WORKSPACE_FINANCE_NAV_PLUGIN_IDS` (`workspaceFinance.supported`) → finance nav |
| **Codegen** | `generateWorkspaceFinanceNavBindings` in `scripts/codegen/workspace-registry/domains/finance.mjs` → `apps/web/src/bootstrap/workspace-finance-nav-bindings.generated.ts` |
| **Runtime** | `finance-nav-enablement.ts` (`shouldShowFinanceNav` / `isFinanceRouteAllowed`) is the only enablement gate; operator nav, dashboard widget, and `/finance` page import it |
| **Preserved** | Denali still `supported: true` → nav visible; Denali `financeOps` panels stay on `@app-cloud/workspace-denali/host/finance/manifest` via `finance-nav-access.ts` (ops UI only — not enablement) |
| **Must NOT** | Redesign UI; change approve/ledger/workflows; full WS2 workspace package/API registry; change users/welcome chrome gates |
| **Verify** | Denali → true; `finance-ws2` → true (architecture-proof nav id); urban/starter/unknown → false; enablement module has zero `isExtendedOperatorWorkspace` / wizard-create imports |

**Phase 1.2 checklist:**

| Item | State |
| ---- | ----- |
| Generated finance nav bindings are source of truth for hub visibility | Done |
| `shouldShowFinanceNav` independent of wizard `extendedChrome` | Done |
| Denali UI behavior preserved (nav on; ops panels unchanged) | Done |
| Denali + finance-ws2 see finance; unsupported workspaces do not | Done |

### Phase 1 — Multi-workspace readiness

| | |
| -- | -- |
| **Goal** | WS2 can enable finance with **workspace package + manifest + codegen**, same HTTP API, own CoA/defaults; Denali behavior unchanged |
| **Step 1 (this slice)** | **Dependency registry only** — `workspaceType` → ledger policy + receipt defaults; boot never imports Denali adapter classes; no WS2 enablement, no HTTP move, no GL |
| **Files affected (Step 1)** | `finance-dependency-registry.ts` (replaces thin `resolve-finance-ledger-policy.ts`); `lazy-finance-service.ts`; `finance.service.ts` (drop Denali receipt default ctor); phase-10 allowlist; registry unit tests |
| **Files affected (later Phase 1)** | codegen finance bindings; WS2 adapters; HTTP/DTO move; nav bindings |
| **Risks** | Wrong CoA if registry mis-keyed; boot singleton still Denali-only until per-tenant resolve; approve TX regression if composition broken |
| **Rollback** | Revert registry commit; restore Phase 0 resolver + boot Denali receipt import |
| **Tests required (Step 1)** | Registry: denali → same adapter classes/values; unknown/empty workspaceType fails clearly; FIN-SVC-* + APPROVE-* unchanged |
| **Must NOT (Step 1)** | WS2 enablement; HTTP/DTO moves; durable GL; async booking; `packages/finance-core`; change Phase 3A/3B identities |

**Phase 1 Step 1 checklist (finance dependency registry):**

| Item | State |
| ---- | ----- |
| Composition registry owns `resolveFinanceLedgerPolicy(workspaceType)` + `resolveFinanceReceiptDefaults(workspaceType)` | Done |
| Only Denali registered at Phase 1.1; `finance-ws2` added in Phase 1.3 | Done |
| Boot wires via registry — no `DenaliFinance*Adapter` imports | Done |
| `FinanceService` has no workspaceType knowledge and no Denali adapter default import | Done |
| Missing / unregistered workspaceType fails with clear error codes | Done |

### Phase 1.3 — Workspace #2 architecture proof

| | |
| -- | -- |
| **Goal** | Prove Finance is **configurable via registry + workspace-owned policy**, not copied per workspace |
| **Kind** | Architecture fixture (`finance-ws2`) under `apps/api/.../infrastructure/` — **not** production workspace onboarding |
| **Shared (unchanged)** | `FinanceService`, `FinanceRepository`, approve/prepay workflows, Phase 3A/3B identity formulas |
| **WS2 owns** | Chart of accounts (`finance-ws2-chart-of-accounts.ts`); ledger policy adapter; offline receipt defaults |
| **WS2 does not own (yet)** | HTTP routes, nav `workspaceFinance.supported`, finance events consumer, ops UI manifest, real `packages/workspaces/*` package |
| **Composition** | `finance-dependency-registry.ts` maps `denali` → Denali adapters, `finance-ws2` → WS2 adapters; boot default remains Denali |
| **Must NOT** | Duplicate `FinanceService`/Repository; workspace-specific approve workflows; bypass registry; import `@app-cloud/workspace-denali` from WS2 modules |
| **Verify** | Registry policy/defaults selection; dual-engine approve under both policies; WS2 sources free of Denali imports; FinanceService has no workspaceType / adapter class imports |

**Phase 1.3 checklist:**

| Item | State |
| ---- | ----- |
| Registry resolves Denali vs `finance-ws2` policies and defaults | Done |
| Same `FinanceService` works with either injected policy | Done |
| WS2 CoA distinct; no Denali account leakage | Done |
| No Denali package import in WS2 modules | Done |
| No copied FinanceService / forked repository | Done |
| Production WS2 nav/HTTP/events/ops manifest deferred | Done |

### Phase 1.4 — Finance-owned HTTP contracts

| | |
| -- | -- |
| **Goal** | Remove Denali ownership of finance request DTOs/schemas; `FinanceService` must not import `@app-cloud/workspace-denali/http` |
| **SoT** | `@app-tour/finance-http-contracts` (`packages/finance-http-contracts`) — zod schemas, inferred types, `parse*` helpers only |
| **Denali compat** | `packages/workspaces/denali/src/http/schemas/finance-request.schemas.ts` re-exports the contracts package; route handlers + codegen `handlerPackage` unchanged |
| **Shared (unchanged)** | Approve/prepay workflows, Phase 3A/3B identities, idempotency leases, ledger CoA, booking TX semantics |
| **Must NOT** | Move finance route handlers / redesign PF-3.1 codegen; extract `finance-core`; durable GL; booking port changes; WS package onboard |
| **Verify** | Parse fixtures identical via Denali re-export vs contracts; FinanceService source has zero `workspace-denali/http`; WS2-injected `FinanceService` accepts same contract bodies |

**Phase 1.4 checklist:**

| Item | State |
| ---- | ----- |
| Request schemas/types/parsers live in `@app-tour/finance-http-contracts` | Done |
| `FinanceService` imports contracts package only (not Denali HTTP) | Done |
| Denali HTTP schemas file is a compatibility re-export | Done |
| Finance HTTP handlers remain Denali-packaged for codegen | Done (deferred move) |
| No ledger / booking / GL / identity changes | Done |

### Phase 2 — Finance core extraction

| | |
| -- | -- |
| **Goal** | Move pure engine + ports + HTTP contract into `packages/finance-core`; `apps/api` keeps Prisma/outbox/storage/boot |
| **Files affected (planned)** | New package; move `finance.service.ts` (sans infra), ports, compile-invoice, enqueue helpers, HTTP schemas/handlers; update imports; Denali thin re-exports |
| **Risks** | Circular deps; guard/boundary violations; slow PR churn |
| **Rollback** | Keep package as re-export façade back to `apps/api` paths |
| **Tests required** | Package unit tests; full finance-ops/prepayments under prisma; import-boundary guard |
| **Must NOT** | Move Prisma schema or `OperatorRegistration` into finance-core; put finance into `platform-core` dump; change identities |

### Phase 3 — Enterprise accounting

| | |
| -- | -- |
| **Goal** | Durable journal, honest GL, optional reconciliation/tax/FX; optional async booking **only with product YES** |
| **Files affected (planned)** | New Prisma models; projector consumer; migrate read path from outbox; optional Prepayment table dual-read |
| **Risks** | Dual-write bugs; historical outbox backfill; reporting drift |
| **Rollback** | Dual-read outbox+journal; feature flag projector |
| **Tests required** | Journal balance invariants; replay/backfill; approve/prepay still green |
| **Must NOT** | Event-source Payment/Receipt aggregates; weaken approve atomicity without sign-off; big-bang drop outbox facts |

---

## 4. Risk Register

| Risk | P | I | Detection | Mitigation |
| ---- | - | - | --------- | ---------- |
| Breaking approve atomicity (Paid without booking paid, or orphan rollback) | M | **Critical** | `finance-ops` APPROVE-TX-*; staging VS-07; abort hooks | Stay on Option C; never Option B for approve without YES; preserve MISS→rollback |
| Losing idempotency (duplicate Paid / double ledger) | M | **Critical** | APPROVE-IDEM-*; PREPAY-IDEM-*; `@@unique(tenantId, domainEventId)` | Do not change Phase 3A/3B key formulas; keep HttpIdempotencyRecord |
| Duplicate financial records | M | High | Conc tests; outbox unique violations logged | Stable seeds; no timestamp in business ids |
| Incorrect ledger identities | L | High | Assert `payment:{id}:ledger-capture-anchor` / prepay `:ledger` in tests | Freeze identity table in P7-FINANCE-PATH-BOUNDARY |
| Workspace policy leakage (WS2 posts Denali CoA) | **H** today | High | Adapter unit tests per workspaceType; boot integration | Policy registry required before WS2 enablement |
| Hidden Denali coupling remaining | **H** | Med | `rg @app-tour/workspace-denali` in finance-core paths; phase guards | HTTP/DTO move + nav decoupling checklist |
| Booking consistency regression | M | **Critical** | FINANCE_BOOKING_* paths; booking list paymentStatus | Fail-closed approve; soft-fail prepay unchanged |
| Outbox semantic confusion (treating facts as GL) | M | Med | Doc + API naming; no trial-balance claims | Hybrid ledger policy in this plan |
| Migration / partial deploy (codegen without adapter) | M | High | Boot fail-fast if supported workspace lacks policy loader | Atomic deploy: manifest + adapter + codegen together |
| Memory driver mistaken for prod | L | High | P7 path boundary; staging `STORAGE_DRIVER=prisma` | Keep memory fake-only norm |

P = probability, I = impact under hostile production review.

---

## 5. Dependency Removal Plan

### If `@app-tour/workspace-denali` disappeared tomorrow

| Breaks | Why |
| ------ | --- |
| `finance.service.ts` | Type-imports HTTP DTOs from Denali |
| `configure-workspace-finance-http-host.ts` | `configureDenaliFinanceHttpHost` |
| `lazy-finance-service.ts` | `DenaliFinanceLedgerPolicyAdapter` |
| `denali-finance-ledger-policy.adapter.ts` | Imports Denali CoA/journal |
| `process-workspace-finance-outbox.ts` / outbox reader | Denali consumer types |
| `workspace-finance-bindings.generated.ts` | `DENALI_WORKSPACE_TYPE` |
| HTTP handler loaders / routes generated | Load `@app-tour/workspace-denali/host/http` |
| Web `finance-nav-access.ts` | Denali financeOps manifest |
| TourCreated finance side-effect bindings | Generated from Denali manifest |

| Still stands (Denali-import-free host pieces) | |
| --------------------------------------------- | - |
| Most of `FinanceRepository` (except conceptual booking coupling) | |
| `compile-invoice-balances`, schedule store, outbox writer, processed-log | |
| Ports files | |
| Prisma Payment/Receipt/Schedule | |

### Classification

| Class | Items |
| ----- | ----- |
| **Hard dependencies** | HTTP DTO/routes package; boot→Denali adapter; generated finance HTTP loaders; bindings import |
| **Soft dependencies** | financeOps manifest for panel toggles; TourCreated side-effect (Denali-only event); IRR defaults (no import, still Denali-shaped) |
| **Safe to treat as extracted already** | Pure invoice compile; port interfaces; outbox enqueue helper; Phase 3A/3B identity helpers in service; receipt defaults port; Option C TX booking port |
| **Required interfaces** | `FinanceLedgerPolicyPort` (exists); TX-aware `raisePaidInTx` on `IBookingPaymentPort` (**Phase 0 Done**); `FinanceReceiptDefaultsPort` (**Phase 0 Done**); `@app-tour/finance-http-contracts` (**P1.4 Done** — handlers still Denali-packaged); nav codegen (**P1.2 Done**) |

---

## 6. File-Level Implementation Map

Phases 1+ planning only — **do not implement from this table without a nano-spec.** Phase 0 Ownership Enforcement rows marked **Done**.

| File | Current responsibility | Problem | Proposed future responsibility | Priority |
| ---- | ---------------------- | ------- | ------------------------------ | -------- |
| `boot/lazy-finance-service.ts` | Wires policy resolver + booking + receipt defaults | — | Policy/defaults registry by workspaceType (Phase 1) | **P0 Done** / P1 next |
| `resolve-finance-ledger-policy.ts` | Boot policy selection | — | Expand via codegen registry | **P0 Done** |
| `finance.service.ts` | Finance application service | — | Core workflows; DTOs from `@app-tour/finance-http-contracts` | **P1.4 Done** |
| `packages/finance-http-contracts` | Zod request contracts | — | Finance-owned HTTP SoT; Denali re-exports | **P1.4 Done** |
| `ports/finance-receipt-defaults.port.ts` + Denali adapter | Offline receipt defaults | — | Multi-WS defaults registry | **P0 Done** |
| `finance.repository.ts` | Prisma atomics | — | TX booking via port only | **P0 Done** (Option C) |
| `ports/booking-payment.port.ts` | Booking contract incl. `raisePaidInTx` | — | Unchanged until further projection APIs | **P0 Done** |
| `infrastructure/booking-payment.adapter.ts` | Non-TX + TX booking projection | — | Own all OperatorRegistration paymentStatus writes | **P0 Done** |
| `infrastructure/denali-finance-ledger-policy.adapter.ts` | Denali CoA posting | Sole adapter | Remain Denali plugin adapter | P0 (keep) |
| `ports/finance-ledger-policy.port.ts` | Ledger policy contract | OK | Unchanged | — |
| `compile-invoice-balances.ts` | Pure invoice math | OK | Stay in core | — |
| `enqueue-finance-ledger-capture.ts` | Outbox ledger enqueue | OK | Stay in core | — |
| `finance-registration-context.ts` | List display via bookings | Accidental Service Locator | Optional `RegistrationDisplayPort` | P2 |
| `assert-finance-access.ts` / `finance-module-enabled.ts` | Gate | OK | Drive from bindings | — |
| `workspace-finance-bindings.generated.ts` | Supported workspaces | Denali-only | Multi-WS + policy loaders | P1 |
| `scripts/codegen/.../finance.mjs` | Generate bindings | Enablement only | policy/defaults/nav exports | P1 |
| `http/configure-workspace-finance-http-host.ts` | Host port injection | Denali-named API | Neutral finance HTTP host | P1 |
| `packages/.../denali/http/finance.routes.ts` | HTTP handlers | Package ownership | Move/share in finance-owned module; Denali re-export | P1 |
| `packages/.../denali/http/schemas/finance-request.schemas.ts` | Compat re-export | Was SoT | Re-exports `@app-tour/finance-http-contracts` | **P1.4 Done** |
| `packages/.../denali/finance/ledger-accounts.ts` | CoA | OK | Stay workspace-owned | — |
| `packages/.../denali/finance/finance-ops-manifest.ts` | UI panels | Web imports Denali | Workspace export; shared type | P1 |
| `apps/web/.../finance-nav-access.ts` | Nav + tabs | wizardCreate + Denali import | Codegen finance nav set + WS ops manifest | P1 |
| `process-workspace-finance-outbox.ts` | TourCreated consumer host | Denali-typed | Stay host; bindings drive runner | P2 |
| `receipt-proof-storage.ts` | MinIO keys | registrationId in path | OK / accidental | P3 |
| `packages/finance-core` | — | Does not exist | Phase 2 extraction target | P2 |
| Prisma `Payment` / `OutboxEvent` | SoT | registrationId no FK | Unchanged near-term | — |

---

## 7. Architecture Decisions

### Accepted

| Decision | Rationale |
| -------- | --------- |
| Manifest-driven composition | Matches repo codegen (`workspaceFinance`, `events[]`, `httpRoutes`) |
| **Option C** booking projection | Preserves Phase 3B fail-closed TX; fixes repository ownership |
| Shared `FinanceService` initially | One workflow proven; avoid premature SPI |
| Preserve Phase 3A/3B `domainEventId` / idempotency identities | Production correctness; P7 normative |
| No premature durable GL | Outbox facts sufficient for current ops UI; hybrid later |
| Keep engine in `apps/api/src/workspace-finance` until Phase 2 | Avoid extraction churn before composition works |
| Do not put Finance into `platform-core` now | platform-core has no finance; AGENTS boundaries |

### Rejected

| Decision | Rationale |
| -------- | --------- |
| Copy Finance per workspace | Destroys shared lifecycle/idempotency proofs |
| `platform-core` extraction now | Wrong package; premature |
| Async booking (Option B) without product approval | Changes approve consistency model |
| Event-sourced accounting rewrite | Payments/receipts already stateful; overkill |
| Workflow plugin SPI before second workflow | Speculative abstraction |
| FK `Payment.registrationId` → `OperatorRegistration` without model review | Orphans exist by design today; FK is a product decision |
| Calling outbox JSON a full GL | Dishonest; blocks clear Phase 3 |

---

## 8. Definition of Done — “WS2 via configuration + workspace plugin only”

Finance is ready to onboard Workspace #2 **without copying FinanceService / Repository / HTTP handlers** when all of the following are true:

### Abstractions

1. **Policy registry:** `workspaceType` → `FinanceLedgerPolicyPort` via manifest codegen; Denali and WS2 each ship an adapter; boot never hardcodes Denali class.
2. **Defaults registry:** offline amount/currency (and similar) from workspace defaults — not literals in `FinanceService`.
3. **Option C:** approve TX booking raise only through TX-capable booking projection port; `finance.repository.ts` has **zero** `operatorRegistration` / `raiseBookingPaymentStatus` imports.
4. **HTTP contract:** request DTOs + finance route handlers owned by finance module (Denali may re-export); `finance.service.ts` does not import `@app-tour/workspace-denali/http`.
5. **Nav:** finance hub visibility from finance codegen bindings (or `workspaceFinance.supported`), **not** `wizardCreate.extendedChrome`.
6. **Ops manifest:** web resolves `FinanceOpsManifest` from workspace export / shared type — not a hard Denali package import required for all workspaces.

### Tests (must stay green + new)

| Suite | Role |
| ----- | ---- |
| `apps/api/test/finance-ops.spec.ts` | Phase 3B approve TX/idempotency (Prisma) |
| `apps/api/test/finance-prepayments.spec.ts` | Phase 3A prepay TX/idempotency/booking soft-fail |
| `finance.service.spec.ts` | Booking sync fail-closed paths |
| **New:** policy registry selects WS2 adapter accounts | Prevent Denali CoA leakage |
| **New:** finance nav binding unit test | Non-Denali plugin id visibility |
| **New:** import boundary — finance-core/service no `workspace-denali` | Ownership |
| Staging VS-07 / P7 receipt approve path | Production parity |

### Documentation

1. This plan kept current or replaced by phase nano-specs.
2. P7-FINANCE-PATH-BOUNDARY Phase 3A/3B identity tables **unchanged**.
3. PAYMENT-LEDGER-BOUNDARY updated only when Option C lands (port-in-TX wording).
4. Explicit note: outbox ledger = integration fact, not GL.

### Explicitly not required for WS2 DoD

- Durable journal tables
- Prepayment first-class table
- Tax / FX / period close
- Async Option B
- `packages/finance-core` (Phase 2 nicety if Phase 1 registries work in-tree)

---

## Appendix A — Authority cross-links

| Doc | Role |
| --- | ---- |
| [P7-FINANCE-PATH-BOUNDARY.md](./P7-FINANCE-PATH-BOUNDARY.md) | Path edit rules; Phase 3A/3B/4A normative |
| [PAYMENT-LEDGER-BOUNDARY.md](./PAYMENT-LEDGER-BOUNDARY.md) | Ingress vs ledger; booking port hexagonal intent |
| [POST-P7-HORIZON.md](./POST-P7-HORIZON.md) | Gateway / future commerce |
| `packages/workspaces/denali/workspace.manifest.json` | Live finance HTTP + events + workspaceFinance |

## Appendix B — Open questions (human decision required)

See return summary §3 — recorded for Architect/product, not decided in this plan.

---

## Document control

| Field | Value |
| ----- | ----- |
| Created | 2026-07-18 |
| Kind | Temporary planning appendix |
| Code impact | **None** |
| Next step | Architect selects Phase 0 vs Phase 1 nano-spec; answer open questions |
