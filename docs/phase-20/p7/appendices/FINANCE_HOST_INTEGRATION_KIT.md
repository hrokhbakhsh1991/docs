# Finance Host Integration Kit

```yaml
kit_id: FINANCE_HOST_INTEGRATION_KIT
version: "2.0"
status: HOST_ADOPTION_COMPLETE
authority: packages/finance-core + packages/finance-http-contracts
audience: external host teams (second app / second repository)
constraints:
  - do not change payment / approve / ledger semantics
  - Prisma, RLS, outbox, booking DB stay host-owned
  - finance-core never imports host DB drivers
```

**Purpose:** A new company or team can compose and run `@app-tour/finance-core` without reading `apps/api`.

**Packages**

| Package | Role |
| ------- | ---- |
| `@app-tour/finance-core` | Domain + application engine (`FinanceService`, ports, pure helpers) |
| `@app-tour/finance-http-contracts` | Zod HTTP body parsers + workspace capability port types (ledger policy, receipt defaults, event reaction) |

**Composition entry:** `createFinanceService(...14 ports)` — every argument is required at the `FinanceService` constructor (`null` / `undefined` → `FINANCE_SERVICE_DEP_REQUIRED`). The factory may default `obligation` to a null port for non-commercial workspaces; hosts that support commercial pricing must pass `createFinanceObligationPort(workspaceType)`.

---

## 0. Ownership map (read first)

### Core responsibility (shipped in finance-core)

| Area | What core owns |
| ---- | -------------- |
| **Domain** | Invoice compile, schedule generation shapes, registration context attachment, pure identity helpers (`hashFinanceHttpIdempotencyKey`, `buildPrepaymentDomainEventIds`) |
| **Application** | Use-case orchestration (`createManualPayment`, `submitReceipt`, `reviewReceipt`, `recordPrepayment`, schedules, invoice read model) |
| **Port contracts** | Interfaces + DTO types the host must implement |
| **Policy consumption** | Calls workspace ledger policy / receipt defaults; does **not** invent CoA |

### Host responsibility (your application)

| Area | What the host owns |
| ---- | ------------------ |
| **Database** | Tables for payments, receipts, prepayments, schedules, degraded sync rows, ledger facts |
| **RLS / tenancy** | Every mutation scoped by `tenantId`; ambient unit-of-work for approve/prepay |
| **Outbox** | Persist `finance.ledger.double_entry_applied` (and optional reaction reads) |
| **Booking system** | Registration payment projection (`unpaid` / `partial` / `paid`); ownership checks |
| **Observability** | Metrics + structured logs behind ports |
| **Storage** | Receipt proof object storage + signed read URLs |
| **Authentication / authz** | Map session → `FinanceActorContext`; enforce operator vs member access |
| **HTTP / idempotency leases** | Transport, Idempotency-Key hashing handoff, lease store (outside ctor) |
| **Workspace product** | Per-`workspaceType` ledger policy, receipt defaults, optional TourCreated reaction |

```text
┌─────────────────────────────────────────────────────────────┐
│ Host process                                                │
│  auth mapper · HTTP · registry(workspaceType) · outbox IO   │
│                                                             │
│   createFinanceService(14 adapters)                         │
│        │                                                    │
│        ▼                                                    │
│   ┌─────────────────┐     ports      ┌──────────────────┐   │
│   │  finance-core   │◄──────────────►│ Host adapters    │   │
│   │  domain+app     │                │ DB/RLS/booking/… │   │
│   └─────────────────┘                └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Required adapters list

Wire **these 14** into `createFinanceService`, in this order:

| # | Port type | Import from | Host classification | One-line duty |
| - | --------- | ----------- | ------------------- | ------------- |
| 1 | `FinanceLedgerPolicyPort` | contracts (re-exported by core) | **Workspace capability** | Build balanced payment-capture + prepayment journals |
| 2 | `FinanceRepositoryPort` | finance-core | **Database + RLS + outbox** | All finance persistence + Option C approve/prepay atomics |
| 3 | `IBookingPaymentPort` | finance-core | **Booking system** | Sync payment status; `raisePaidInTx` inside host TX |
| 4 | `FinanceReceiptDefaultsPort` | contracts | **Workspace capability** | Offline receipt amount/currency defaults |
| 5 | `RegistrationDisplayPort` | finance-core | **Booking / CRM read** | Batch tour/member display for list enrichment |
| 6 | `FinanceMetricsPort` | finance-core | **Observability** | `increment(name, labels?, amount?)` |
| 7 | `FinanceStorageDriverPort` | finance-core | **Storage / mode** | Durable vs memory; DB configured flags |
| 8 | `ReceiptProofStoragePort` | finance-core | **Storage** | Signed read URL for receipt `fileKey` |
| 9 | `FinanceCapabilityPort` | finance-core | **Auth / product gate** | Tenant → workspaceType + module enabled |
| 10 | `FinanceAuthorizationPort` | finance-core | **Authentication** | Operator vs receipt-submit role checks |
| 11 | `FinanceSchedulePort` | finance-core | **Database** | Persist installment schedules per registration |
| 12 | `FinanceLoggerPort` | finance-core | **Observability** | `warn` / `error` |
| 13 | `FinanceClockPort` | finance-core | **Host infra** | `nowIso()` (injectable for tests) |
| 14 | `FinanceObligationPort` | finance-core / contracts | **Commercial pricing** | Registration obligation minor; null port when unbound |

### Composition sketch (host-owned)

```ts
import { createFinanceService } from "@app-tour/finance-core";

const finance = createFinanceService(
  ledgerPolicy,          // 1  workspace
  repository,            // 2  DB + RLS + outbox
  bookingPayments,       // 3  booking
  receiptDefaults,       // 4  workspace
  registrationDisplay,   // 5  booking read
  metrics,               // 6  observability
  storageDriver,         // 7  mode flags
  receiptProofStorage,   // 8  object storage
  capability,            // 9  product gate
  authorization,         // 10 authz
  schedules,             // 11 DB
  logger,                // 12 observability
  clock,                 // 13 clock
  obligation             // 14 commercial obligation (or null port)
);
```

`apps/api` composition root (`lazy-finance-service`) wires #14 via `createFinanceObligationPort(workspaceType)`. Boot/legacy `resolveLazyFinanceService` requires `FINANCE_BOOT_WORKSPACE_TYPE` (no silent denali default).

### Not ctor args (still required for a full production host)

| Contract | Package SoT | Host duty |
| -------- | ----------- | --------- |
| Outbox **writer** (enqueue in TX) | Host-defined (see §5) | Insert `finance.ledger.double_entry_applied` last in approve/prepay UoW |
| Outbox **reader** (reaction batches) | Host-defined | Feed `WorkspaceFinanceEventReactionPort` |
| `WorkspaceFinanceEventReactionPort` | `@app-tour/finance-http-contracts` | Optional TourCreated → finance reaction |
| HTTP Idempotency-Key lease store | Host HTTP layer | Acquire/reclaim before calling service |
| Auth session → `FinanceActorContext` | Host | Map user/tenant/role/status |

### Actor context (every use-case)

```ts
type FinanceActorContext = {
  userId: string;
  tenantId: string;
  role: "owner" | "admin" | "member" | "viewer" | "none";
  status: "ACTIVE" | "SUSPENDED";
  workspaceId?: string;
};
```

---

## 2. Required lifecycle contracts

| Phase | Host must | Core does |
| ----- | --------- | --------- |
| **Boot** | Build adapters; register `workspaceType → { ledgerPolicy, receiptDefaults, … }`; optionally cache `FinanceService` per workspaceType | Nothing (no process-global state) |
| **Request start** | Authenticate; map → `FinanceActorContext`; resolve tenant → workspaceType → service instance | — |
| **Gate** | — | Calls `capability.assertEnabled(tenantId)` then `authorization.assert*` |
| **Use-case** | Adapters execute IO | Orchestrates domain rules + port calls |
| **Approve / prepay** | Repository opens **one** tenant UoW; booking participates via `raisePaidInTx` | Builds journal plan; passes `ledgerCapture` when durable |
| **After commit** | Relay/outbox consumers (host workers) | — |
| **Shutdown** | Dispose DB pools, storage clients, metrics exporters | No connections to close |

### Per-request sequence

```text
HTTP/RPC
  → mapAuth(session) → FinanceActorContext
  → resolveService(tenantId)   // registry by workspaceType
  → finance.<useCase>(auth, …)
       → capability.assertEnabled
       → authorization.assert*
       → ledgerPolicy / repository / booking / schedules / proof / metrics / logger / clock
```

### Storage-mode lifecycle

| Flag | Host sets when | Engine effect |
| ---- | -------------- | ------------- |
| `isDurablePersistence() === true` | Real DB / production | `reviewReceipt` approve passes `ledgerCapture` into repository |
| `isDurablePersistence() === false` | In-memory / unit tests | Approve **without** attaching ledgerCapture (no outbox enqueue expected) |
| `isDatabaseConfigured() === false` | Cold boot / missing DSN | `getSummary` returns zeroed counters |

---

## 3. Transaction requirements (Option C — frozen)

Hosts **must** preserve these semantics. Changing order or ownership breaks payment/booking consistency.

### 3.1 Approve atomic unit of work

Triggered by `FinanceService.reviewReceipt(…, { decision: "approve" })` → `repository.approveManualReceiptAtomic`.

**Inside one tenant-scoped transaction (or fail-closed memory simulation):**

| Step | Order | Owner | Action |
| ---- | ----- | ----- | ------ |
| 1 | first | Repository | Payment → `Paid` |
| 2 | | Booking port | `bookingPayments.raisePaidInTx(tx, { tenantId, registrationId })` → projection `paid` |
| 3 | | Repository | Receipt → `Approved` (+ `ledgerJournalId`) |
| 4 | **last** | Repository + outbox | If `ledgerCapture` present: enqueue `finance.ledger.double_entry_applied` |

```text
Paid → raisePaidInTx(tx) → Approved → outbox(ledgerCapture) last
```

**Rules**

- Booking mutation uses the **same** ambient `tx` handle the repository opened (`FinanceTransactionPort` is opaque `object` — host casts inside the booking adapter only).
- Repository must **not** write booking tables directly.
- If booking raise misses the registration → fail closed (`FINANCE_BOOKING_PAYMENT_SYNC_MISS` path); entire UoW rolls back.
- Concurrent loser: throw `FINANCE_APPROVE_CONFLICT`; service may replay if winner already `Approved`+`Paid`.
- Idempotent replay: if receipt already `Approved` and payment already `Paid`, return success without re-mutating.
- **HTTP contract (APPROVE-RACE-01):** concurrent approve with different idempotency keys returns **only** `200` (winner or non-destructive replay) or `409` (`FINANCE_APPROVE_CONFLICT` / Prisma `P2002`/`P2034`). Do **not** emit `400 ZOD_VALIDATION_FAILED: receipt already Approved` or `cannot review receipt for payment with status Paid` on the approve path — those are race-visible states, not client validation. Host repository must coerce Prisma unique/write-conflict errors from the approve TX to `FINANCE_APPROVE_CONFLICT` so the engine replay branch can run.

### 3.2 Reject path

`updateReceiptReview(…, Rejected)` — **not** required to share the approve TX; no ledger outbox; no booking raise.

### 3.3 Prepayment atomic unit of work

`recordPrepayment` → `repository.recordPrepaymentAtomic`:

| Requirement | Detail |
| ----------- | ------ |
| Idempotency | Keys from `buildPrepaymentDomainEventIds(registrationId, idempotencyKey)` — **no timestamps** |
| Persist | Prepayment row + ledger lines plan |
| Outbox | Enqueue ledger event with `ledgerDomainEventId` inside same UoW when durable |
| Booking sync | Soft-fail allowed after commit: `syncStatus`; on failure record degraded row (`recordPrepaymentBookingSyncDegraded`) |

Prepayment domain ids (core helper — host must store/use these strings):

```text
prepaymentDomainEventId = prepayment:{registrationId}:{keyHash}
ledgerDomainEventId     = {prepaymentDomainEventId}:ledger
journalSeed             = prepay:{registrationId}:{keyHash}
```

### 3.4 Payment-capture domain id (workspace ledger policy)

Reference / freeze formula for capture journals:

```text
domainEventId = payment:{paymentId}:ledger-capture-anchor
```

Lines must balance (debits = credits) in `amount_minor` per currency.

### 3.5 What must never leave the host TX

- Tenant RLS session variables / `SET LOCAL` equivalents
- Outbox insert for ledger capture
- Payment + receipt + booking raise for approve

---

## 4. Repository implementation requirements

Implement **every** method on `FinanceRepositoryPort`. Partial stubs are not production-safe.

### 4.1 Method catalog

| Method | Semantics |
| ------ | --------- |
| `getSummary` | Counts: pending manual payments, pending receipt reviews, paid, failed |
| `listOpenPayments` / `listPayments` | Operator lists; honor `limit` |
| `listLedgerEvents` | Read durable ledger facts (typically outbox rows shaped as `FinanceLedgerOutboxRow`) |
| `findPaymentStatusesByRegistration` | Used with invoice `balanceDueMinor` to block extra manual debt after settlement / while Pending exists (PR20-D; Paid alone is not settlement) |
| `createManualPayment` | Persist `Pending` manual payment; unique on `creationIdempotencyKey` when set |
| `findPaymentById` / `findPaymentByCreationIdempotencyKey` | Lookups + idempotent create replay |
| `findFirstPendingManualPayment` | Member offline-receipt bootstrap |
| `findLatestReceiptForRegistration` | Member receipt status |
| `createReceipt` | Pending receipt; unique on `idempotencyKeyHash` when set |
| `findReceiptById` / `listPendingReceipts` | Review queue |
| `updateReceiptReview` | Reject (and non-atomic updates as needed) |
| `approveManualReceiptAtomic` | **§3.1** — Option C |
| `listPrepayments` / `recordPrepaymentAtomic` | **§3.3** |
| `recordPrepaymentBookingSyncDegraded` / `listOpen…` / `mark…Recovered` | Soft-fail booking sync recovery |
| `getRegistrationInvoiceFacts` | Aggregates for `compileRegistrationInvoice` |

### 4.2 Idempotency storage

| Key | Source | Store as |
| --- | ------ | -------- |
| Payment create | HTTP Idempotency-Key → `hashFinanceHttpIdempotencyKey` | `creationIdempotencyKey` (SHA-256 hex) |
| Receipt submit | same helper | `idempotencyKeyHash` |
| Prepayment | `buildPrepaymentDomainEventIds` | `clientOperationKeyHash` + domain event ids |

Conflicts: throw stable codes (`FINANCE_PAYMENT_IDEMPOTENCY_CONFLICT`, etc.) — do not silently overwrite.

### 4.3 Row shapes (contract)

Host rows returned to core must match exported DTO types (`FinancePaymentRow`, `FinanceReceiptRow`, `FinanceLedgerOutboxRow`, …). Especially:

- Money as **string** minor units where the port says `amount` / `amountMinor`
- `FinanceLedgerOutboxRow.payload` object with at least `lines[]`, `registrationId`, `journalId` for list mapping

### 4.4 Forbidden inside finance-core (and inside “portable” adapters)

Do **not** put these in the engine package:

- Prisma / Drizzle / SQL clients
- RLS helpers
- Outbox table helpers imported from a host SDK
- Workspace package imports (`@app-tour/workspace-*`)

Those belong only in **your** repository / outbox adapters.

---

## 5. Event integration requirements

### 5.1 Primary integration event

| Field | Value |
| ----- | ----- |
| `eventType` | `finance.ledger.double_entry_applied` |
| When | End of approve TX (if `ledgerCapture`) and end of durable prepay TX |
| Aggregate | Finance ledger / journal (`aggregateId` ≈ `journalId`) |
| `domainEventId` | From `FinanceLedgerCapturePlan.domainEventId` (stable; no timestamps) |
| Payload (minimum) | `{ journalId, registrationId, lines: FinanceLedgerJournalLine[] }` |

`FinanceLedgerJournalLine` (contracts):

```ts
{
  id, journalId, tenantId, account,
  side: "debit" | "credit",
  amount_minor, currency,
  correlationId, idempotencyKey,
  createdAt, reversesLineId?, metadata?
}
```

### 5.2 How core participates

1. Workspace `FinanceLedgerPolicyPort` builds a **plan** (`FinanceLedgerCapturePlan`).
2. Core passes the plan into the repository as `ledgerCapture` (approve) or line fields (prepay).
3. **Host** enqueues the outbox row inside the same UoW.
4. Core never imports an outbox writer type.

### 5.3 Optional workspace reaction (TourCreated → finance)

Implement `WorkspaceFinanceEventReactionPort` from contracts:

| Method | Duty |
| ------ | ---- |
| `consumePendingForTenant(tenantId)` | Batch pull host-published rows; return `{ handled, skipped }` |
| `reactToPublishedRow(row)` | Apply one published outbox row; return whether handled |

Host supplies reader IO; workspace (or host-wired policy) supplies reaction logic. Generic event **runtime** must not hard-import a specific workspace package.

### 5.4 Neutrality rule

| Allowed | Forbidden |
| ------- | --------- |
| Host outbox writer/reader | finance-core importing Prisma outbox |
| Generated bindings in **host** composition | Engine depending on `*.generated.ts` |
| Contracts reaction port | Embedding Denali (or any product) side effects in core |

---

## 6. Workspace capability requirements

A host supporting multiple products registers capabilities **per `workspaceType`**.

| Capability | Port | Required? | Notes |
| ---------- | ---- | --------- | ----- |
| Ledger policy | `FinanceLedgerPolicyPort` | **Yes** (ctor #1) | `buildPaymentCaptureJournal` + `buildPrepaymentJournal` |
| Receipt defaults | `FinanceReceiptDefaultsPort` | **Yes** (ctor #4) | `offlineReceiptPaymentDefaults()` → `{ amountMinor, currency }` |
| Module / workspace gate | `FinanceCapabilityPort` | **Yes** (ctor #9) | Unsupported → `FINANCE_WORKSPACE_UNSUPPORTED`; disabled module → `FORBIDDEN_FINANCE_MODULE_DISABLED` |
| Event reaction | `WorkspaceFinanceEventReactionPort` | Optional | TourCreated → ledger |
| Chart of accounts labels | Inside ledger policy | Recommended | Accounts appear on journal lines |
| Ops UI panels | Host/web only | Optional | Not part of finance-core |

### Ledger policy contract

```ts
interface FinanceLedgerPolicyPort {
  buildPaymentCaptureJournal(input: BuildPaymentCaptureJournalInput): FinanceLedgerCapturePlan;
  buildPrepaymentJournal(input: BuildPrepaymentJournalInput): FinanceLedgerCapturePlan;
}
```

Plans must be **pure** (no DB). Stable ids across retries.

### Capability gate contract

```ts
interface FinanceCapabilityPort {
  assertEnabled(tenantId: string): Promise<{ workspaceType: string; theme: unknown }>;
}
```

### Authorization contract

```ts
interface FinanceAuthorizationPort {
  assertOperatorAccess(auth: FinanceActorContext): void;      // review, lists, schedules, …
  assertReceiptSubmitAccess(auth: FinanceActorContext): void; // member/operator submit
}
```

### Registration without monorepo codegen

External hosts may hand-wire:

```ts
const registry: Record<string, {
  ledgerPolicy: FinanceLedgerPolicyPort;
  receiptDefaults: FinanceReceiptDefaultsPort;
}> = {
  "acme-club": { ledgerPolicy: acmeLedger, receiptDefaults: acmeDefaults },
};
```

Resolve at request time from `capability.assertEnabled` → `workspaceType` → registry entry → `createFinanceService(...)`.

---

## 7. Port interface reference (minimal)

### Booking (`IBookingPaymentPort`)

| Method | TX? | Behavior |
| ------ | --- | -------- |
| `raisePaidInTx(tx, { tenantId, registrationId })` | **Yes** | Set projection `paid`; throw/miss → approve rollback |
| `syncStatus({ tenantId, registrationId, paymentStatus })` | No | Best-effort projection (`unpaid` \| `partial` \| `paid`) |
| `memberOwnsRegistration(…)` | No | Member receipt paths |
| `getPaymentStatus(…)` | No | Read current projection |

### Infra stubs (acceptable non-prod)

| Port | Stub OK? |
| ---- | -------- |
| Metrics / logger | Yes (no-op) |
| Clock | Fixed ISO in tests |
| Proof storage | Return any `https://` URL |
| Schedules | In-memory map |
| Capability | Always enable one `workspaceType` |
| Authz | Allow admin/owner; members for submit |

### Engine helpers hosts should call (not reinvent)

| Helper | Use |
| ------ | --- |
| `hashFinanceHttpIdempotencyKey(key)` | Payment/receipt HTTP idempotency |
| `buildPrepaymentDomainEventIds(registrationId, key)` | Prepay identities |
| `compileRegistrationInvoice` / schedule builders | Via service use-cases / domain exports |

---

## 8. Stable error codes (host should map to HTTP)

| Code | Typical cause |
| ---- | ------------- |
| `FINANCE_SERVICE_DEP_REQUIRED` | Missing ctor port |
| `FINANCE_WORKSPACE_UNSUPPORTED` | Capability gate |
| `FORBIDDEN_FINANCE_MODULE_DISABLED` | Capability gate |
| `FINANCE_PAYMENT_NOT_FOUND` / `FINANCE_RECEIPT_NOT_FOUND` | Missing rows |
| `FINANCE_PAYMENT_IDEMPOTENCY_CONFLICT` | Idempotency collision |
| `FINANCE_APPROVE_CONFLICT` | Concurrent approve |
| `FINANCE_BOOKING_PAYMENT_SYNC_MISS` | Approve booking raise miss |
| `FINANCE_BOOKING_PAYMENT_SYNC_FAILED` | Booking infra error |
| `ZOD_VALIDATION_FAILED:…` | Domain validation (incl. already reviewed / already Paid debt) |

---

## 9. Conformance checklist (before production)

- [ ] All 13 ports non-null at composition
- [ ] Create manual payment + idempotent replay
- [ ] Submit receipt + idempotent replay
- [ ] Approve: Paid + booking `paid` + Approved + ledger outbox **same TX** (durable mode)
- [ ] Approve conflict / replay safe
- [ ] Reject: no ledger / no booking raise
- [ ] Prepay: stable domain ids; ledger enqueue; soft-fail booking + degraded recovery
- [ ] Capability fail-closed for unknown workspace
- [ ] Authz separates operator vs member submit
- [ ] No finance-core import of Prisma / workspace packages

Optional in-tree proof patterns (not required reading): package tests under `packages/finance-core/test/external-consumer/` and `test/isolation/`.

---

## 10. Related docs

| Doc | When to open |
| --- | ------------ |
| [`PAYMENT-LEDGER-BOUNDARY.md`](./PAYMENT-LEDGER-BOUNDARY.md) | Payment ingress vs ledger spine |
| [`FINANCE_DEPS_WORKSPACE_TO_REGISTRY.md`](./FINANCE_DEPS_WORKSPACE_TO_REGISTRY.md) | Installing packages outside the monorepo |
| [`FINANCE_CORE_EXTRACTION_READINESS.md`](./FINANCE_CORE_EXTRACTION_READINESS.md) | Packaging maturity (not needed to implement adapters) |

**Code SoT (prefer over any host tree):**

- `packages/finance-core/src/application/finance.service.ts` — `createFinanceService`
- `packages/finance-core/src/ports/*.ts` — port interfaces
- `packages/finance-http-contracts/src/workspace-finance-ports.ts` — ledger / reaction types
