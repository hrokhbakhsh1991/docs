# Finance Platform Developer Guide

```yaml
doc_id: FINANCE_PLATFORM_DEVELOPER_GUIDE
version: "1.0"
date: "2026-07-19"
audience: new engineers joining finance platform work
status: accepted
authority:
  - FINANCE_HOST_INTEGRATION_KIT
  - FINANCE_WORKSPACE_ONBOARDING_LIFECYCLE
  - FINANCE_CORE_INTERNAL_FREEZE
  - docs/phase-20/p7/appendices/adr/INDEX.md
constraints:
  - do not invent APIs — cite packages and ADRs
  - prefer fast-track verification (see docs/dev/tiered-testing.md)
```

**Goal:** Onboard a new engineer so they can add a finance workspace (ledger, receipts, reaction, ops) without breaking Option C, event neutrality, or package boundaries.

---

## 1. Architecture overview

### What lives where

| Layer | Package / location | Owns |
| ----- | ------------------ | ---- |
| **Engine** | `@app-tour/finance-core` | `FinanceService`, domain helpers, **port interfaces** |
| **Contracts** | `@app-tour/finance-http-contracts` | HTTP body parsers + workspace capability port **types** (ledger, receipt, reaction) |
| **HTTP** | `@app-tour/finance-http` | Shared `/finance/*` route manifest + handlers (workspace-agnostic) |
| **Host** | `apps/api` | Prisma/RLS repository, outbox, composition (`resolveFinanceServiceForTenant`), recon, replay |
| **Web hub** | `apps/web` | Finance panels/nav; ops via generated bindings (no workspace package imports in generic UI) |
| **Product** | `packages/workspaces/<id>` | CoA, ledger policy, receipt defaults, optional reaction + opsManifest |

```text
Tenant request
  → auth + tenantId
  → resolveFinanceWorkspaceTypeForTenant
  → resolveFinanceServiceForTenant(workspaceType)
       ├─ ledgerPolicy + receiptDefaults   (codegen from manifest)
       ├─ Prisma repository + booking port (host)
       └─ FinanceService (finance-core)
  → approve / prepay / reports …

TourCreated outbox
  → dispatch → WorkspaceFinanceEventReactionPort (per workspaceType)
  → optional HostIo when requiresHostIo: true
```

### Normative decisions (read once)

| Topic | ADR |
| ----- | --- |
| Approve TX order (Option C) | [ADR-001](./adr/ADR-001-option-c-approve-atomicity.md) |
| Manifest → codegen registry | [ADR-002](./adr/ADR-002-workspace-finance-capability-registry.md) |
| finance-core freeze / monorepo | [ADR-003](./adr/ADR-003-finance-core-monorepo-boundary.md) |
| HostIo | [ADR-004](./adr/ADR-004-hostio-event-reaction.md) |
| Event neutrality | [ADR-005](./adr/ADR-005-event-neutrality.md) |
| Repository boundary | [ADR-006](./adr/ADR-006-repository-boundary.md) |
| Outbox replay | [ADR-007](./adr/ADR-007-outbox-failed-replay.md) |
| Reconciliation | [ADR-008](./adr/ADR-008-reconciliation-repair.md) |
| SLOs | [ADR-009](./adr/ADR-009-finance-slo-framework.md) |
| Wallet credit XOR | [ADR-010](./adr/ADR-010-duplicate-wallet-credit-xor.md) |
| Stable ledger ids | [ADR-011](./adr/ADR-011-adapter-identity-stability.md) |

Full ADR index: [`adr/INDEX.md`](./adr/INDEX.md).

### Option C (memorize)

Prisma approve UoW order (host repository):

```text
Paid → booking.raisePaidInTx(tx) → Approved → outbox(ledgerCapture) last
```

Capture `domainEventId` formula (do **not** change):

```text
payment:{paymentId}:ledger-capture-anchor
```

---

## 2. Workspace onboarding (checklist)

Proven path: copy patterns from `finance-ws3`…`finance-ws6` / Denali. Lifecycle audit: [`FINANCE_WORKSPACE_ONBOARDING_LIFECYCLE.md`](./FINANCE_WORKSPACE_ONBOARDING_LIFECYCLE.md).

### Repeatable steps

1. Create `packages/workspaces/<id>/` (scaffold: `pnpm run workspace:create -- <id>`).
2. Implement finance adapters under `src/finance/` (ledger, receipt, CoA, reaction[, ops]).
3. Declare `workspaceFinance` in `workspace.manifest.json` (see §5).
4. Ensure `tourWrite.workspaceTypeExport` exists (codegen requires it for finance).
5. Export package entrypoints used by codegen (`./finance`, `./host/finance`, ops `./finance/manifest` if needed).
6. **Human:** add `"@app-tour/workspace-<id>": "workspace:*"` to `apps/api/package.json`.
7. **Human (if opsManifest):** same dep in `apps/web/package.json`.
8. `pnpm install` → build workspace package → `pnpm run generate:workspace-registry`.
9. Point a tenant’s `workspace_type` at `<id>`; enable finance module in theme if needed.
10. Add an onboarding/regression spec under `apps/api/src/workspace-finance/` (copy `finance-ws5-onboarding.spec.ts`).

### What you do **not** do

- Edit hand-written workspace-id arrays in capability gates.
- Edit generated `*.generated.ts` files by hand.
- Change `FinanceService` / Option C / capture formulas for a new product.
- Add a second `/finance` HTTP stack inside finance-core or the workspace.

### Manifest minimum (engine + gate + nav)

```json
"workspaceFinance": {
  "supported": true,
  "defaultModuleEnabledWhenUnset": true,
  "ledgerPolicy": { "module": "./finance", "export": "YourLedgerPolicyAdapter" },
  "receiptDefaults": { "module": "./finance", "export": "YourReceiptDefaultsAdapter" },
  "chartOfAccounts": { "module": "./finance", "export": "YOUR_LEDGER_ACCOUNTS" },
  "eventReaction": {
    "module": "./finance",
    "export": "YourTourCreatedFinanceReactionAdapter",
    "requiresHostIo": false
  }
}
```

- `registryOnly: true` + `supported: true` is **invalid** (ws2 is registry-only proof).
- Add `opsManifest` if the operator hub must show panels (without it → nav may appear, panels resolve to **null**).

---

## 3. Adding a ledger policy

### Contract

Implement `FinanceLedgerPolicyPort` from `@app-tour/finance-http-contracts`:

- `buildPaymentCaptureJournal(input)` → `FinanceLedgerCapturePlan`
- `buildPrepaymentJournal(input)` → `FinanceLedgerCapturePlan`

### Rules

| Rule | Detail |
| ---- | ------ |
| Capture id | Always `payment:{paymentId}:ledger-capture-anchor` |
| Prepay id | Use caller `ledgerDomainEventId` (host-built) |
| CoA | Workspace-owned account codes; **must not collide** with other workspaces’ prefixes |
| Wallet id | Workspace-owned prefix (e.g. `ws3:booking:{registrationId}`, not bare `booking:` unless you are Denali) |
| Stable journal/lines | Seed deterministic UUIDs; **no** `randomUUID` fallback ([ADR-011](./adr/ADR-011-adapter-identity-stability.md)) |
| Balance | Debit ≠ credit accounts; positive `amount_minor` |
| Imports | Contracts + local CoA only — **never** `apps/api`, Prisma, or another workspace’s finance helpers |

### Reference

`packages/workspaces/finance-ws3/src/finance/ledger-policy.adapter.ts`  
Denali production path: `packages/workspaces/denali/src/finance/adapters/denali-finance-ledger-policy.adapter.ts`

Wire via manifest `ledgerPolicy` + regenerate registry.

---

## 4. Adding receipt defaults

### Contract

Implement `FinanceReceiptDefaultsPort`:

```ts
offlineReceiptPaymentDefaults(): { amountMinor: string; currency: string }
```

### Rules

- Pair with `ledgerPolicy` in the same manifest (codegen enforces together).
- Use a **distinct** currency/amount from other products when proving isolation (fixtures: IRR/USD/EUR/GBP/CAD/AUD).
- Do not hardcode Denali IRR into generic `apps/web` when fixing UI — seed from this port / ops currencies.

### Reference

`packages/workspaces/finance-ws3/src/finance/receipt-defaults.adapter.ts`

---

## 5. Adding a finance workspace (end-to-end)

Treat this as the product checklist after adapters exist.

| # | Task | Done when |
| - | ---- | --------- |
| 1 | Package + `workspace.manifest.json` | `id` matches package name / workspaceTypes |
| 2 | CoA export | Unique GL + wallet prefixes |
| 3 | Ledger + receipt adapters | Specs assert distinct defaults vs Denali |
| 4 | Reaction adapter | Registered; HostIo flag correct |
| 5 | Optional opsManifest | Panels + currencies for hub |
| 6 | `apps/api` dependency | Codegen can static-import `/host/finance` |
| 7 | `apps/web` dependency (ops) | Ops bindings include your id |
| 8 | `generate:workspace-registry` | New keys in `workspace-finance-*-bindings.generated.ts` |
| 9 | Onboarding spec | `listRegistered…` / resolve deps / CoA assertions |
| 10 | Tenant seed | `workspace_type=<id>`; smoke create/approve if durable |

Shared HTTP `/finance/*` is already mounted in this monorepo (finance-http via existing route registration). New workspaces **reuse** it through `resolveFinanceServiceForTenant` — they do not ship parallel handlers.

---

## 6. Adding reactions

### Contract

`WorkspaceFinanceEventReactionPort` (`finance-http-contracts`):

- `consumePendingForTenant(tenantId)`
- `reactToPublishedRow(row)`

### Manifest

```json
"eventReaction": {
  "module": "./finance",
  "export": "YourTourCreatedFinanceReactionAdapter",
  "requiresHostIo": false
}
```

| Flag | When |
| ---- | ---- |
| `requiresHostIo: false` | Fixture / no-op / self-contained reaction (ws3–ws6 pattern) |
| `requiresHostIo: true` | Needs platform claim + outbox writer + processed store + fail log (Denali Path B) |

Host injects HostIo at resolve time when true ([ADR-004](./adr/ADR-004-hostio-event-reaction.md)). Do **not** revive `register-workspace-finance-deps` singletons.

### Neutrality

Generic host modules must not import `@app-tour/workspace-*` ([ADR-005](./adr/ADR-005-event-neutrality.md), guard `FIN-EVENT-NEUTRAL-01`). Only generated bindings and the workspace package itself reference the adapter class.

### Money safety

If your reaction posts a booking-wallet credit, honor Path A XOR Path B ([ADR-010](./adr/ADR-010-duplicate-wallet-credit-xor.md)). Stub reactions that return `false` / `{ handled: 0 }` are fine for architecture proof — **not** for claiming production peer workflows.

---

## 7. Testing

### Default verification (do not run full gates unless asked)

| Intent | Command |
| ------ | ------- |
| Pre-commit style | `pnpm run pre-commit:fast` |
| Import boundary | `pnpm run guard:import-boundary` |
| Finance-core guards | `pnpm -C packages/finance-core run guard:boundary` (and portability/public-api) |
| **Golden architecture (G1–G7, fail-build)** | `pnpm run guard:finance-golden` |
| Changed tests | `pnpm run test:changed` |
| Workspace package | `pnpm -C packages/workspaces/<id> run build` then targeted `node --import tsx --test …` |

See [`docs/dev/tiered-testing.md`](../../../dev/tiered-testing.md). Never run `phase-5:gate` / `test:full` / `ci:integrity` without explicit **YES**.

### What to cover for a new finance workspace

| Area | Example |
| ---- | ------- |
| Registry | Type listed; ledger/receipt factories resolve |
| Receipt defaults | Currency/amount ≠ Denali IRR/2500000 |
| CoA | Codes/wallet prefix unique |
| Capture id | `payment:{uuid}:ledger-capture-anchor` |
| Identity | Same seeds → same journal/line ids across two builds |
| Ops (if declared) | Manifest panels/currencies |
| Ownership / HTTP | Prefer existing `finance-*-ownership.spec.ts` patterns — do not reintroduce Denali imports into host runtime |

Reference specs: `apps/api/src/workspace-finance/finance-ws5-onboarding.spec.ts`, `adapter-identity-stability.spec.ts`, `packages/workspaces/denali/test/ledger-identity-stability.spec.ts`.

---

## 8. Common mistakes

| Mistake | Why it hurts | Do instead |
| ------- | ------------ | ---------- |
| Change capture `domainEventId` to include HTTP key | Breaks approve idempotency / recon | Keep `payment:{paymentId}:ledger-capture-anchor` |
| `randomUUID()` for journal/line ids | Double journals on retry/replay | Seed from paymentId / journalSeed / TourCreated id |
| Copy Denali CoA codes into a new WS | Cross-product wallet collision | Namespaced codes (`wsN:gl:…`, `wsN:booking:`) |
| `supported: true` without `opsManifest`, expect panels | Hub renders **null** panels | Add opsManifest + `apps/web` dep, or accept API-only |
| `requiresHostIo: true` without HostIo-capable adapter | Runtime/type failures | Follow Denali pattern or keep `false` + stub |
| Import `@app-tour/workspace-denali` from finance-core or generic host runtime | Boundary / neutrality break | Contracts + codegen only |
| Edit `*.generated.ts` | Overwritten on next codegen | Fix manifest / package exports, regenerate |
| Skip `apps/api` package.json dep | Codegen cannot import your `/host/finance` | Add workspace dep then regenerate |
| Assume memory driver = Option C | Not TX-equivalent | Prove money paths on Prisma + RLS |
| Implement TourCreated credit without XOR check | Double wallet credit | Advisory lock + existing-credit skip/throw |
| Fix money bugs by changing Option C order | Silent accounting breaks | Keep Paid → raisePaid → Approved → outbox last |

---

## 9. Forbidden dependencies

### Inside `packages/finance-core`

Must **not** import:

- `@prisma/*` / Prisma client  
- `apps/api` / `@apps/api`  
- `@app-tour/workspace-*` / `packages/workspaces/*`  
- `@app-tour/workspace-sdk` (use `FinanceActorContext` from core)  
- `*.generated.*`  
- `node:fs` / `fs`  
- `process.env`  

Allowed: relative package imports, `node:crypto`, `@app-tour/finance-http-contracts`.

### Inside `packages/workspaces/<id>` finance adapters

Must **not** import:

- `apps/api` / Prisma host repositories  
- Other workspaces’ finance internals (e.g. Denali `postDoubleEntryJournal` from ws3)  
- Generated host bindings  

Allowed: `@app-tour/finance-http-contracts`, local CoA/helpers, (Denali-only) its own finance modules.

### Inside generic host finance runtime (`apps/api/src/workspace-finance` non-generated)

Must **not** hard-import workspace packages for TourCreated façades — use registry/codegen ([ADR-005](./adr/ADR-005-event-neutrality.md)).

### Inside generic `apps/web` finance UI

Must **not** import workspace packages directly — resolve ops via `@/bootstrap/workspace-finance-ops-bindings.generated`.

---

## 10. Boundary rules (cheat sheet)

```text
┌────────────────────────────────────────────────────────────┐
│ finance-core          │ ports + orchestration only         │
├────────────────────────────────────────────────────────────┤
│ finance-http-contracts│ shared types for workspace + HTTP  │
├────────────────────────────────────────────────────────────┤
│ workspace package     │ CoA + ledger + receipt + reaction  │
├────────────────────────────────────────────────────────────┤
│ apps/api host         │ Prisma, RLS, outbox, composition   │
├────────────────────────────────────────────────────────────┤
│ codegen bindings      │ only place that names all WS ids   │
└────────────────────────────────────────────────────────────┘
```

| Rule | Owner |
| ---- | ----- |
| Option C TX + outbox insert | Host `FinanceRepositoryPort` |
| Journal shape / CoA | Workspace ledger policy |
| Offline receipt defaults | Workspace receipt defaults |
| TourCreated → finance | Workspace reaction (+ HostIo if required) |
| HTTP `/finance/*` | Shared finance-http (not per-WS route tables in-core) |
| Tenant isolation | `tenantId` + RLS — not `workspaceType` alone |
| Doc-first for core/host architecture changes | Update `docs/` Markdoc/MD **before** changing `finance-core` / protected packages (repo covenant) |

---

## 11. First-week learning path

1. Read this guide + [ADR index](./adr/INDEX.md) (001, 005, 006, 011 first).  
2. Skim [`FINANCE_HOST_INTEGRATION_KIT.md`](./FINANCE_HOST_INTEGRATION_KIT.md) §0–§3.  
3. Trace one approve on Prisma: `FinanceService.reviewReceipt` → `approveManualReceiptAtomic`.  
4. Diff `finance-ws3` vs Denali finance folders.  
5. Run one onboarding spec and one identity-stability spec locally.  
6. Before any core change: propose doc update; prefer fast-track verification.

---

## 12. Related docs

| Doc | Use |
| --- | --- |
| [`FINANCE_HOST_INTEGRATION_KIT.md`](./FINANCE_HOST_INTEGRATION_KIT.md) | External/host port list |
| [`FINANCE_WORKSPACE_ONBOARDING_LIFECYCLE.md`](./FINANCE_WORKSPACE_ONBOARDING_LIFECYCLE.md) | Human wire checklist |
| [`FINANCE_CAPABILITY_SYSTEM_MATURITY.md`](./FINANCE_CAPABILITY_SYSTEM_MATURITY.md) | Manifest field maturity |
| [`FINANCE_CORE_INTERNAL_FREEZE.md`](./FINANCE_CORE_INTERNAL_FREEZE.md) | Core API freeze |
| [`FINANCE_ADAPTER_IDENTITY_STABILITY.md`](./FINANCE_ADAPTER_IDENTITY_STABILITY.md) | Deterministic ids |
| [`FINANCE_HOSTILE_MULTI_PRODUCT_CERTIFICATION.md`](./FINANCE_HOSTILE_MULTI_PRODUCT_CERTIFICATION.md) | What “parity” still lacks |
| [`FINANCE_GOLDEN_ARCHITECTURE_TESTS.md`](./FINANCE_GOLDEN_ARCHITECTURE_TESTS.md) | Forever boundary tests (`pnpm run guard:finance-golden`) |
| [`AGENTS.md`](../../../../AGENTS.md) | Monorepo commands + architecture rules |
