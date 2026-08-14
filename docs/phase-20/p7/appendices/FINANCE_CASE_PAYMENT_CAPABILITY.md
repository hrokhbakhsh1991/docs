# Finance Case Payment Capability Adapter Architecture (PR10-A)

```yaml
doc_id: FINANCE_CASE_PAYMENT_CAPABILITY
version: "2026-08-07-v4"
package: "@app-tour/finance-core/case (vocabulary + read ports)" · Workspace adapters · SoT
status: ARCHITECTURE + PR10-B/C + PR13-C PORTABILITY PROOF
phase: PR10-A · PR10-B · PR10-C · PR13-C workspace portability
authority: >
  FINANCE_CASE_INTERPRETER_BOUNDARY · Case payment/evidence/obligation ports ·
  PR4 Denali read adapters · Interpreter Rules v1 · PR13-C portability proof
related:
  - docs/phase-20/p7/appendices/FINANCE_CASE_INTERPRETER_BOUNDARY.md
  - packages/finance-core/src/case/ports/case-payment-fact.port.ts
  - packages/finance-core/src/case/ports/case-evidence-fact.port.ts
  - apps/api/src/workspace-finance/case/payment-capability/
  - apps/api/src/workspace-finance/case/portability/
```

## Purpose

Formalize **workspace payment capability switching** without changing finance-core meaning.

```text
finance-core does not know payment providers.
Workspaces select providers and adapt SoT → portable facts.
Interpreter stays unchanged.
```

**This phase covers architecture (PR10-A), Host fake foundation (PR10-B), and the first real online gateway adapter (PR10-C).** Capture/refund commands, hybrid composite, and UI checkout remain deferred.

---

## Hard locks (PR10-A)

| Lock | Meaning |
| ---- | ------- |
| finance-core ↛ payment providers | No Stripe/manual/offline types in `src/case/` |
| PaymentFacts remain portable | `IntentFacts` + `SettlementFacts` only at the Case boundary |
| Manual receipt and online payment are **adapters** | Same Case ports; different SoT translations |
| SoT owns settlement truth | Case reads settlement **meaning**; does not settle |
| Interpreter unchanged | Switching capability must not rewrite Case laws |
| No gateway logic in core | Webhooks, capture, 3DS stay in workspace/Host |
| No payment repair automation | Repair remains SoT/product + future Host bridge — not Case |

---

## 1. Capability boundary

```text
┌─────────────────────────────────────────────────────────────┐
│ Workspace payment capability config                         │
│   manual_evidence | online_gateway | hybrid (multi-provider)│
└────────────────────────────┬────────────────────────────────┘
                             │ selects / composes
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Payment Capability Adapters (workspace / Host)              │
│   ManualEvidencePaymentAdapter                              │
│   OnlineGatewayPaymentAdapter                               │
│   CompositePaymentAdapter (A∪B providers)                   │
│                                                             │
│   + Evidence adapters (offline receipt / gateway proof)     │
└───────────────┬─────────────────────────────▲───────────────┘
                │ translate only               │ read SoT
                ▼                              │
┌───────────────────────────┐     ┌───────────┴───────────────┐
│ Case *read* ports         │     │ Payment / Evidence SoTs   │
│ CasePaymentFactPort       │     │ (FinanceService rows,     │
│ CaseEvidenceFactPort      │     │  gateway ledger, receipts)│
│ (+ obligation/lifecycle)  │     └───────────────────────────┘
└───────────────┬───────────┘
                │ CasePaymentFactBundle + EvidenceFacts
                ▼
┌───────────────────────────┐
│ finance-core              │
│ assemble → interpret      │
│ Intent / Settlement /     │
│ Evidence / Money facts    │
│ → CaseOutput (unchanged)  │
└───────────────────────────┘
```

### What crosses the boundary

| Into finance-core | Never into finance-core |
| ----------------- | ----------------------- |
| `intentSet`, `intentKind`, `intentOpen`, provenance, duplicate cues | Provider account ids, API keys, webhook payloads |
| `settlementMeaning` (unsettled/captured/…) | Capture/refund RPC results as Case commands |
| `proofExists`, `proofProgress`, `evidenceSource` (`offline` \| `gateway` \| …) | Stripe PaymentIntent objects, PSP fee lines |
| `unknown` / `absent` / `known` TriFacts | “Manual vs online” as a Case reading enum |

### Ownership

| Layer | Owns |
| ----- | ---- |
| **finance-core** | Payment **meaning** vocabulary (`IntentKind`, `SettlementMeaning`, `EvidenceSource`, ports) |
| **Workspace** | Provider selection, adapter implementation, capability configuration |
| **SoT** | Payment truth, settlement validation, capture/refund/dispute ledgers |

---

## 2. Provider selection model

### Capability modes (workspace config — conceptual)

| Mode | Typical binding | Adapters active |
| ---- | --------------- | --------------- |
| **A — Manual evidence** | Offline / club transfer + receipt upload | Manual payment intent adapter + offline evidence adapter |
| **B — Online gateway** | Hosted checkout / PaymentIntent | Online payment intent adapter + gateway evidence/settlement adapter |
| **C — Hybrid** | Manual **and** online for same workspace | Composite: merge intents/settlement/evidence with **unknown-on-gap** rules |

### Selection principles

1. **Config, not interpreter branches** — workspace theme / module flags / Host DI choose adapters.  
2. **One CaseKey still one meaning** — hybrid does not create two CaseOutputs for one commercial subject unless product defines separate caseKeys.  
3. **Provider fan-in at adapter** — composite adapters normalize N SoT streams into **one** `CasePaymentFactBundle` + **one** `EvidenceFacts`.  
4. **Unsupported capability → unknown** — if online is configured but gateway SoT unavailable, facts are `unknown` (with reason), **never** coerced to zero amounts or `absent` intent when the read failed.  
5. **Absent vs unknown** — “no payment rows after successful read” may be `intentSet: known("none")`; “gateway timeout” must be `unknown`.

### Conceptual config shape (not implemented here)

```text
PaymentCapabilityConfig = {
  mode: "manual" | "online" | "hybrid"
  providers: [
    { id: "offline_manual", kind: "manual_evidence" },
    { id: "stripe_checkout", kind: "online_gateway", /* workspace-only opts */ }
  ]
  onProviderFailure: "degrade_unknown"  // never zero-fill
}
```

---

## 3. Adapter contract

Adapters implement **existing** Case read ports (or Host façades that do). They must not import `interpret/`, `rules/`, or emit CaseOutput.

### Payment adapter

```text
WorkspacePaymentCapabilityAdapter
  readPaymentFacts(scope) → CaseFactProviderResult<CasePaymentFactBundle>
```

Responsibilities:

- Map provider SoT → `IntentFacts` + `SettlementFacts`  
- Set `intentKind`: `manual` | `one_shot` | `recurring` | `other` from **portable** cues (not brand names in core)  
- Preserve `unknown` on read failure  

### Evidence adapter (paired)

```text
WorkspaceEvidenceCapabilityAdapter
  readEvidenceFacts(scope) → CaseFactProviderResult<EvidenceFacts>
```

Responsibilities:

- Manual path → `evidenceSource: offline` when proof is receipt upload  
- Online path → `evidenceSource: gateway` when proof is PSP confirmation / charge pack  
- Never invent `proofProgress: accepted` from UI heuristics  

### Composite (hybrid) rules

| Situation | Required behavior |
| --------- | ----------------- |
| Manual receipt in review + open gateway intent | Portable facts may show `intentSet: many` / duplicate suspected — interpreter laws apply unchanged |
| One provider fails, other succeeds | Failed slice → unknown fields or degraded provider diagnostic; do not drop successful slice into zero |
| Both absent after clean reads | known none / absent proof — not unknown |

### Forbidden adapter behaviors

- Calling capture/refund inside `readPaymentFacts`  
- Writing Case status  
- Branching on `workspaceType` **inside finance-core**  
- Passing Stripe/Denali DTO types into `CaseFacts`  

---

## 4. Migration path

### Phase 0 — Today (Denali enrollment)

- Manual / offline-heavy SoT → existing Denali payment + evidence mappers  
- Intent kind heuristics already map `manual` / `gateway` **strings from SoT** into portable `IntentKind` — keep that translation **outside** core  

### Phase 1 — Capability config (Host/workspace)

- Introduce workspace `PaymentCapabilityConfig` (docs → later code)  
- DI selects manual vs online adapter implementations without touching interpreter  

### Phase 2 — Online-only workspace (B)

- New online adapter: gateway SoT → same `CasePaymentFactPort` / `CaseEvidenceFactPort`  
- Prove: identical portable facts → identical CaseOutput (fixture parity with manual scenarios where meanings match)  

### Phase 3 — Hybrid (C)

- Composite adapter + explicit conflict cues (`duplicateOrParallelSuspected`)  
- No new Case readings for “hybrid”  

### Phase 4 — Command bridge awareness (later)

- Host bridge continues to target **existing** SoT commands (e.g. `reviewReceipt` for offline evidence)  
- Online capture/refund remain SoT commands — **not** Case repair  

### Non-migration

- Do **not** migrate gateway SDKs into finance-core  
- Do **not** add `ONLINE_SETTLED` Case reading — use existing settlement + evidence facts  

---

## 5. Portability validation

| Probe | Manual | Online | Hybrid |
| ----- | ------ | ------ | ------ |
| **A Enrollment** | Receipt evidence + manual intent (current Denali) | Optional gateway for deposits | Config-driven |
| **B Subscription** | Rare offline exception | Primary recurring / one_shot intents | Dunning + offline exception |
| **C Marketplace** | Dispute packs as evidence | Buyer capture / seller payout as **separate caseKeys** | Per-caseKey provider set |

### Required proofs (when implementing adapters — not this PR)

| # | Proof |
| - | ----- |
| 1 | Switching manual → online = adapter + config only (no `rules/*` diff) |
| 2 | Same portable FactSnapshot → same CaseOutput |
| 3 | Gateway types never appear under `packages/finance-core/src/case/` |
| 4 | Workspace A/B/C can register different adapter DI graphs |
| 5 | Unsupported / failed provider → `unknown` (not zero / not false `absent`) |

### Architectural proof stance (PR10-A)

These proofs are **gates for future adapter PRs**. This document freezes the boundary so those PRs cannot “fix” switching by changing interpreter meaning.

---

## Deliverables checklist

| # | Deliverable | Section |
| - | ----------- | ------- |
| 1 | Capability boundary | §1 |
| 2 | Provider selection model | §2 |
| 3 | Adapter contract | §3 |
| 4 | Migration path | §4 |
| 5 | Portability validation | §5 |

---

## Implementation readiness verdict

| Item | Status |
| ---- | ------ |
| Portable payment/evidence vocabulary + ports | **Ready** (existing) |
| Denali manual/offline-oriented mappers | **Ready** (existing; outside core) |
| PR10-A capability architecture | **Ready (this doc)** |
| Online gateway adapter implementation | **Ready (PR10-C)** — `OnlineGatewayPaymentCaseFactProvider` + `PaymentGatewayPort` |
| Hybrid composite adapter | **Not started** |
| Workspace capability config schema in code | **Not started** |
| Interpreter / CaseOutput changes | **Forbidden** for capability switching |

**Verdict:** Architecture is ready to gate workspace adapter/config work. finance-core meaning stays fixed; providers stay outside.

---

## PR10-B — Payment capability adapter foundation (Host)

```yaml
phase: PR10-B
module: apps/api/src/workspace-finance/case/payment-capability/
status: IMPLEMENTED (manual + online fake · no real gateway)
```

### What shipped

| Artifact | Role |
| -------- | ---- |
| `PaymentCapabilityMode` | Host-only `manual` \| `online` (never imported by finance-core) |
| `selectPaymentCaseFactProvider` | Host DI seam — chooses `CasePaymentFactPort` |
| `ManualPaymentCaseFactProvider` | Wraps existing Denali payment SoT → portable PaymentFacts |
| `OnlinePaymentCaseFactProvider` | Fake/test online adapter — gateway ids stay outside facts |
| `createDenaliCaseFactProviders` `payment` override | Assembler uses selected port without core knowing mode |

### Proofs

See `payment-capability-adapter.spec.ts` — manual parity, online fake path, no core gateway imports, unknown≠zero, evidence≠payment failure, degrade-safe, signal≠verdict.

### Still deferred (after PR10-B)

Real gateway port, webhooks ingestion path, capture/refund commands, hybrid composite, UI.

---

## PR10-C — Real online gateway adapter (Host)

```yaml
phase: PR10-C
module: apps/api/src/workspace-finance/case/payment-capability/gateway/
status: IMPLEMENTED (PaymentGatewayPort + OnlineGateway* providers · no Stripe SDK in core)
```

### What shipped

| Artifact | Role |
| -------- | ---- |
| `PaymentGatewayPort` | Host-owned read boundary (opaque refs; no Case types) |
| `InMemoryPaymentGateway` | Host SoT stand-in + webhook ingestion target |
| `ingestGatewayWebhookEvent` | Webhook → Host gateway SoT only (Case never consumes webhooks) |
| `OnlineGatewayPaymentCaseFactProvider` | Gateway → portable Intent/Settlement facts |
| `OnlineGatewayEvidenceCaseFactProvider` | Gateway proof → portable EvidenceFacts |
| `GatewayObservationSink` | Latency / degradation / unsupported-field observation (non-blocking) |
| Composition | `createDenaliCaseFactProvidersWithPaymentCapability({ mode: "online", gateway })` |

### Migration success

```text
Manual receipt payment  →  Online gateway payment
= replace adapters / PaymentCapabilityMode + DI only
finance-core / interpreter / EncounterView / command vocabulary unchanged
```

### Still deferred

Vendor Stripe SDK package, capture/refund/chargeback commands, multi-gateway marketplace routing, UI checkout.

---

## Related: reconciliation (PR11-A)

Gateway↔SoT compare is **not** payment capability switching. See [`FINANCE_CASE_RECONCILIATION.md`](./FINANCE_CASE_RECONCILIATION.md) for Host recon ownership, conflict taxonomy, and resolution-via-SoT rules. Payment adapters remain translate-only; recon emits portable cues without Case state.

---

## PR13-C — Workspace portability proof

```yaml
doc_id: FINANCE_CASE_PAYMENT_CAPABILITY.PR13-C
status: SIMULATION PROOF (not production second workspace)
module: apps/api/src/workspace-finance/case/portability/
```

### Multi-workspace configuration model

```text
workspace
  → capabilities (manual | online | hybrid, recon on/off)
    → adapters (SoT → Case*FactPort)
      → CaseFactAssemblerProviders
        → executeFinanceCase (finance-core)
          → CaseOutput → EncounterView
```

| Workspace (example) | Capabilities | Adapters | Core |
| ------------------- | ------------ | -------- | ---- |
| Denali | manual payment + receipts | Denali / ManualPayment* | unchanged |
| Marketplace (sim) | online payment + gateway evidence | Marketplace* (no Denali imports) | unchanged |

### Portability guarantees

| Guarantee | Meaning |
| --------- | ------- |
| Same portable facts → same CaseOutput | Interpreter has no workspace identity |
| Adapters own translation | Gateway ids / SoT DTOs never enter CaseFacts |
| finance-core owns meaning | Laws / readings / ownership unchanged per workspace |
| Host owns authz + composition | UI never composes providers |
| UI consumes EncounterView only | Presentation contract unchanged |

### What changes per workspace

- SoT shapes, capability flags, adapter implementations, Host DI wiring

### What never changes

- `executeFinanceCase` / interpreter laws  
- Case port shapes  
- EncounterView projection contract  
- Unknown-not-zero / degrade-on-failure semantics  

### Simulation artifacts

| Artifact | Role |
| -------- | ---- |
| `composeMarketplaceCaseFactProviders` | Workspace B composition (marketplace buyer) |
| Marketplace payment/evidence/lifecycle adapters | Translate marketplace DTOs → portable facts |
| `workspace-portability.spec.ts` | Proofs 1–8 + scenarios A–E |

**Not shipped:** production marketplace workspace package, routing, or UI.

---

## Final rule (canonical)

```text
Providers are workspace clothing.
PaymentFacts are the body finance-core understands.
Switch the clothing — do not rewrite the body.
Unknown stays unknown when the closet is empty or on fire.
```

---

## Non-goals (PR10-A–C)

- Shipping vendor Stripe SDK package inside finance-core  
- Changing `interpretFinanceCase` laws  
- Payment repair automation in Case  
- Merging buyer + seller payment into one CaseKey  
- Core knowledge of provider brand names as types  
- Capture / refund / chargeback **commands**  
- Hybrid composite / multi-gateway marketplace routing  
- UI checkout flows  
