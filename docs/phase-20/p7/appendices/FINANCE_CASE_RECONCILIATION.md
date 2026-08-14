# Finance Capability Reconciliation Architecture (PR11-A)

```yaml
doc_id: FINANCE_CASE_RECONCILIATION
version: "2026-08-07-v3"
package: "@app-tour/finance-core/case (portable cues only)" · Workspace Host recon layer · SoTs
status: ARCHITECTURE + PR11-B CLASSIFIER + PR11-C DENALI COMPOSITION
phase: PR11-A architecture · PR11-B Host classifier · PR11-C Denali composition
authority: >
  FINANCE_CASE_INTERPRETER_BOUNDARY · Interpreter Rules v1 ·
  PR10 Payment Capability · PR10-C Online Gateway Adapter ·
  PR6-B / PR9 Command Bridge · Port Contracts v1
related:
  - docs/phase-20/p7/appendices/FINANCE_CASE_INTERPRETER_BOUNDARY.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_PAYMENT_CAPABILITY.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_COMMAND_BRIDGE.md
  - packages/finance-core/src/case/facts/fact-groups.ts (AuditCueFacts.reconFinding)
  - apps/api/src/workspace-finance/case/reconciliation/
  - apps/api/src/workspace-finance/case/compose-denali-case-providers.ts
```

## Purpose

Design the **reconciliation boundary** between:

1. **Gateway observations** (external payment provider / webhook-ingested Host ledger)  
2. **Workspace finance SoTs** (FinanceService payment rows, obligation, receipts, booking payment status)  
3. **Case interpretation** (portable FactSnapshot → CaseOutput → EncounterView)

```text
Gateway facts
      ↓
Workspace reconciliation layer   ← owns compare / classify / cue emission
      ↓
Portable finance facts           ← Intent / Settlement / Evidence / AuditCue
      ↓
Case interpreter                 ← meaning only; no recon state
      ↓
EncounterView                    ← display only; no repair
```

**This phase covered architecture (PR11-A).** **PR11-B** implements the Host classifier + portable cue emission under `apps/api/.../case/reconciliation/` — still no schema, API, UI, or auto-repair.

---

## Hard locks (PR11-A)

| Lock | Meaning |
| ---- | ------- |
| **finance-core never owns reconciliation state** | No recon sessions, mismatch rows, or “recon status” inside `src/case/` |
| **Case never stores payment lifecycle** | Ephemeral CaseOutput; gateway/SoT lifecycle stays in Host/SoT ledgers |
| **No auto-repair** | Detection ≠ mutation; no silent sync from gateway → SoT or Case |
| **No gateway-specific logic in core** | Stripe/PayPal enums, webhook names, capture APIs stay Host-side |
| **No mutation from reconciliation** | Recon layer is **read-compare-cue**; writes only via existing SoT commands / Command Bridge |
| **SoTs remain authoritative** | Settlement truth, payment rows, receipts — not Case, not gateway alone |
| **Unknown remains unknown** | Unreadable gateway or SoT → TriFact `unknown`; never coerce to zero / false `absent` / fake `captured` |
| **Interpreter unchanged for capability add** | Adding recon must not rewrite Case laws or Encounter projection |
| **Command vocabulary unchanged** | Recon may *suggest* investigation; it does not invent new Case verbs |

### Inherited (still binding)

CaseOutput ephemeral · adapters translate only · signals ≠ verdict · payment capability adapters outside core · webhooks → Host SoT before Case read.

---

## 1. Reconciliation ownership

| Concern | Owner | Must not own |
| ------- | ----- | ------------ |
| **Gateway observation ledger** | Host / workspace payment capability (`PaymentGatewayPort` SoT) | finance-core, Case |
| **Finance SoT rows** (payments, obligations, receipts, booking payment status) | Existing FinanceService / product SoTs | Case, recon “shadow DB” as authority |
| **Compare & classify** (gateway vs SoT vs evidence) | **Workspace reconciliation layer** (Host) | Interpreter, EncounterView |
| **Portable cue emission** | Host Case read adapters (`auditCues.reconFinding`, `exceptionCues.meaningConflict`, settlement/evidence TriFacts) | Gateway SDK, UI |
| **Interpretation meaning** | finance-core interpreter | Recon layer inventing owner/posture |
| **Operator display** | EncounterView (existing attention / completeness / explanation channels) | Recon inventing verdict copy |
| **Investigate / retry / repair / approve correction** | Humans + Host Command Bridge → **target SoT commands** | Case repository, auto-recon worker writing SoT without bridge |

```text
┌──────────────────────────────────────────────────────────────────┐
│ Workspace reconciliation layer (Host — OUTSIDE finance-core)     │
│                                                                  │
│  inputs:  GatewayPaymentRecord*  ·  Finance SoT payment DTO*     │
│           Evidence/receipt SoT*  ·  (optional) ledger refs       │
│  owns:    conflict class · severity · investigation hints        │
│  emits:   portable facts / cues ONLY into Case read providers    │
│  never:   CaseOutput patches · gateway capture · silent SoT sync │
└────────────────────────────┬─────────────────────────────────────┘
                             │ TriFacts + AuditCueFacts.reconFinding
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ finance-core                                                     │
│  assemble → interpret → CaseOutput → projectCaseEncounter        │
│  may READ reconFinding / meaningConflict as *facts*              │
│  does NOT run compare loops or store mismatch history            │
└──────────────────────────────────────────────────────────────────┘
```

\*Gateway and SoT DTOs remain Host-private; Case sees only portable fact groups.

### Relationship to existing portable cues

| Existing Case fact | Recon role |
| ------------------ | ---------- |
| `AuditCueFacts.reconFinding` (`none` \| `mismatch`) | Coarse portable signal that Host detected a cross-source conflict |
| `ExceptionCueFacts.meaningConflict` | Stronger “sources disagree on money meaning” cue when Host asserts it |
| `SettlementFacts.settlementMeaning` | SoT- and/or adapter-chosen **settlement meaning** after Host policy (not raw gateway status) |
| `EvidenceFacts.*` | Proof presence/progress/source — recon may note duplicate/missing proof via facts, not Case history |
| `IntentFacts.duplicateOrParallelSuspected` | Host may set when recon detects parallel payment intents |

**Rule:** Recon **feeds** these cues. It does **not** add a `ReconciliationStatus` type to finance-core in PR11-A. Expanding TriFact vocabulary (if ever needed) is a separate core PR with explicit portability review — default is Host-side classification + existing cues.

---

## 2. Fact categories (recon input model)

Host reconciliation classifies observations into five **fact categories**. Categories are Host vocabulary for compare logic; only portable TriFacts cross into Case.

| Category | Definition | Typical source | Case mapping (examples) |
| -------- | ---------- | -------------- | ----------------------- |
| **Gateway observed** | External provider / Host gateway ledger says something about intent or capture | `PaymentGatewayPort` record after webhook ingest | Contributes to intent/settlement **only after** Host adapter policy; never raw `pi_` / brand enums |
| **SoT recorded** | Workspace finance ledger has a payment / booking payment status row | FinanceService / Denali payment SoT | Primary input to `CasePaymentFactPort` in manual mode; peer in online/hybrid |
| **Settlement confirmed** | Authoritative settlement assertion per workspace policy | SoT settlement field **and/or** gateway `settled` when Host policy says SoT must confirm | `settlementMeaning: captured` only when confirmation policy satisfied; else `unknown` or `unsettled` |
| **Evidence available** | Inspectable proof exists (receipt upload or gateway receipt URL) | Evidence SoT / gateway evidence state | `EvidenceFacts` (`offline` \| `gateway` \| …) |
| **Degraded / unknown** | Read failed, timeout, unsupported field, partial row | Observation sinks, failed gateway/SoT reads | TriFact `unknown`; `ok: false` + degraded on provider result |

### Category rules

```text
1. Gateway observed ≠ Settlement confirmed
   (PR10-C: missing settlement after intent_succeeded → unknown, not unpaid)

2. SoT recorded ≠ Case truth
   (Case reads SoT via adapters; Case does not become a second ledger)

3. Evidence available ≠ paid
   (proof can exist while settlement is unsettled / unknown)

4. Degraded / unknown never collapses to zero / absent / captured
```

### Compare tuple (Host-internal)

For a given `caseKey` / subject, Host recon builds an ephemeral compare tuple:

```text
ReconCompareTuple = {
  gatewayObserved?:   { lifecycle, settlement, amount?, externalRef* }
  sotRecorded?:       { paymentStatus, amount?, provider, method }
  settlementConfirmed?: boolean | "unknown"
  evidenceAvailable?: { source, progress }
  degraded?:          { gateway?: reason, sot?: reason }
}
```

\* `externalRef` stays Host-side for investigation tooling; **stripped** before Case facts.

The tuple is **not** persisted as Case state. Optional Host operational stores (ops inbox, metrics) are product concerns outside this boundary and must not be imported by finance-core.

---

## 3. Conflict taxonomy

Conflicts are **Host classification labels**. They map into portable cues; they are not Case readings.

| Code | Pattern | Typical portable emission | Must not do |
| ---- | ------- | ------------------------- | ----------- |
| `GW_PAID_SOT_MISSING` | Gateway settled / succeeded; SoT has no payment row or booking still unpaid with empty payments | `reconFinding: mismatch`; settlement often `unknown` or SoT-derived `unsettled`; optional `meaningConflict` | Auto-insert SoT payment |
| `SOT_PAID_GW_UNKNOWN` | SoT shows paid/captured; gateway unread / outage / no record | Keep SoT settlement if policy trusts SoT; `reconFinding: mismatch` or `none` per workspace; gateway side `unknown` must not wipe SoT to unpaid | Treat gateway silence as refund |
| `AMOUNT_MISMATCH` | Gateway amount ≠ SoT amount (same subject) | `reconFinding: mismatch`; `meaningConflict: true` when Host asserts money-meaning conflict | Average amounts into Case |
| `DUPLICATE_PAYMENT_EVIDENCE` | Two proofs / two intents for one obligation | `duplicateOrParallelSuspected: true`; evidence progress unchanged unless SoT says otherwise | Merge payments in Case |
| `DELAYED_SETTLEMENT` | Intent succeeded; settlement still pending/unknown beyond SLA | settlement `unknown` or `unsettled`; attention signal only (discovery) | Force `captured` on timer |
| `GW_REFUNDED_SOT_CAPTURED` | Gateway refunded/disputed; SoT still paid | `reconFinding: mismatch`; `meaningConflict` likely | Auto-refund SoT |
| `EVIDENCE_WITHOUT_INTENT` | Receipt present; no payment intent / gateway none | evidence facts present; intent `none` or open manual; not a payment failure by itself | Mark settlement captured from receipt alone without SoT policy |
| `PARTIAL_DEGRADED` | One source ok, other failed | degraded provider(s); unknown on failed side; known on healthy side | Fill gaps with defaults |

### Severity (Host-only)

| Severity | Use | Case impact |
| -------- | --- | ----------- |
| **info** | Delayed settlement within SLA | Optional attention; facts may stay consistent |
| **investigate** | GW↔SoT mismatch | `reconFinding: mismatch` → audit/attention paths per existing interpreter rules |
| **block-repair** | Amount / ownership conflict requiring human | Same cues + Host forbids auto Command Bridge repair; operator investigates |

Severity is **not** a finance-core enum in PR11-A.

---

## 4. Resolution boundary

Reconciliation **detects**. Resolution **mutates SoTs** through existing authority paths.

| Action | Who may | Mechanism | Forbidden |
| ------ | ------- | --------- | --------- |
| **Investigate** | Operator / Host ops tooling | Read gateway ledger + SoT + EncounterView; Host may show `externalRef` **outside** Case snapshot | Patching CaseOutput; Case history as audit of record |
| **Retry** | Host / automation | Re-read gateway port / SoT (idempotent reads); re-execute Case | Retry that performs capture/refund |
| **Repair** | Authorized operator → **Command Bridge** → target SoT command | e.g. create/adjust payment row, review receipt, booking payment status update — **existing** SoT APIs only | Case-driven silent sync; recon worker writing Prisma without SoT service |
| **Approve correction** | Host authz + SoT validation | Same dual-gate as PR6-B/PR9: vocabulary allow ≠ execute; SoT accepts/rejects; mandatory re-execute | “Case approved” lifecycle; recon approval stored as Case status |

```text
Conflict detected (Host recon)
        │
        ▼
Portable cues → assemble → interpret → EncounterView
        │
        │  operator chooses to act
        ▼
Command Bridge (authz + vocabulary)
        │
        ▼
Existing SoT mutation
        │
        ▼
Fresh gateway/SoT reads → new FactSnapshot → new CaseOutput
```

### Explicit non-resolutions

- Gateway webhook **must not** mutate Case.  
- Recon mismatch **must not** auto-call capture/refund.  
- EncounterView **must not** expose “Fix now” that bypasses Command Bridge.  
- finance-core **must not** grow a `resolveConflict()` API.

---

## 5. Multi-workspace portability

| Capability mode | Primary settlement source | Recon emphasis | Adapter note |
| --------------- | ------------------------- | -------------- | ------------ |
| **Manual** | SoT + offline receipt evidence | Receipt vs obligation; duplicate receipts; SoT paid without proof | `ManualPaymentCaseFactProvider` + evidence provider; gateway optional/absent |
| **Online** | Gateway observation → Host policy → SoT confirmation | GW↔SoT gaps; delayed settlement; amount mismatch | `OnlineGateway*` + Finance SoT peer compare in Host recon |
| **Hybrid** | Explicit Host composition policy (ordered sources) | Multi-source conflicts; parallel intents; which source confirms settlement | Composite payment adapters (deferred PR) + recon taxonomy shared |

### Portability invariants

| Probe | Requirement |
| ----- | ----------- |
| **A Enrollment** | Same conflict codes; Denali binder only changes SoT/gateway loaders |
| **B Subscription** | Recurring intent cycles; delayed settlement common; still no Case lifecycle store |
| **C Marketplace** | Buyer vs seller **separate caseKeys**; recon never merges payout+payment into one Case |

### Success criterion (architectural)

```text
A workspace adds reconciliation capability by:
  Host recon module + DI into Case read adapters (cue emission)
WITHOUT changing:
  finance-core rules / interpretFinanceCase
  CaseEncounterView contract
  Command Bridge vocabulary
```

---

## 6. Placement relative to PR10 payment capability

```text
External Gateway
        │
        ▼
PaymentGatewayPort (PR10-C)
        │
        ├──────────────────────────────┐
        ▼                              ▼
OnlineGateway* Case fact providers   Workspace reconciliation layer
        │                              │ compare vs Finance SoT
        │                              ▼
        │                         portable cues (reconFinding, …)
        │                              │
        └──────────────┬───────────────┘
                       ▼
              CaseFactAssemblerProviders
                       ▼
              executeFinanceCase → EncounterView
```

Recon is a **sibling** of payment capability adapters, not a replacement. Payment adapters still translate one source at a time; recon decides how conflicts between sources become portable cues **before** or **as part of** provider composition (Host choice).

**Recommended Host pattern (future implementation PRs):**

1. Read gateway + SoT independently.  
2. Run `classifyRecon(tuple)` → conflict codes + severity.  
3. Choose settlement/evidence/intent TriFacts per workspace policy (trust SoT, trust gateway only if SoT confirms, else unknown).  
4. Set `reconFinding` / `meaningConflict` / duplicate cues.  
5. Assemble & interpret — no recon state retained in Case.

---

## 7. Observation & operations (non-blocking)

Align with PR10-C observation sinks:

| Signal | Purpose |
| ------ | ------- |
| Recon conflict rate by code | Ops calibration |
| Degraded source rate | Reliability |
| Time-in-`DELAYED_SETTLEMENT` | SLA monitoring |

These metrics **must not** block primary finance workflows or gate Case execution.

---

## 8. Implementation readiness (deferred)

| Item | Status |
| ---- | ------ |
| Ownership + taxonomy + resolution boundary | **Ready (PR11-A)** |
| Host `classifyRecon` module | **Ready (PR11-B)** — `apps/api/.../case/reconciliation/` |
| Wiring cues into Denali ledger / payment providers | **Ready (PR11-B)** — cue-augmented Case fact providers |
| Denali production composition (shadow / encounter / live) | **Ready (PR11-C)** — `composeDenaliCaseFactProviders` |
| Ops UI for investigate | **Not started** |
| Auto-repair / settlement engine | **Forbidden** |
| finance-core recon state / Case payment lifecycle store | **Forbidden** |

### Suggested later phases

| Phase | Scope |
| ----- | ----- |
| **PR11-B** | **IMPLEMENTED** — Host classifier + portable cue emission + proofs |
| **PR11-C** | **IMPLEMENTED** — Denali production composition (payment + recon) |
| **Later** | Operator investigate chrome; Command Bridge repair mappings for specific SoT fixes |

---

## PR11-B — Host reconciliation classifier & cue emission

```yaml
phase: PR11-B
module: apps/api/src/workspace-finance/case/reconciliation/
status: IMPLEMENTED (Host-only · no finance-core · no schema/API/UI)
```

### What shipped

| Artifact | Role |
| -------- | ---- |
| `classifyPaymentReconciliation` | Pure Host compare: gateway vs finance SoT observations |
| Finding taxonomy | `GW_PAID_SOT_MISSING`, `SOT_PAID_GW_UNKNOWN`, `AMOUNT_MISMATCH`, `DUPLICATE_PAYMENT_EVIDENCE`, `SETTLEMENT_DELAYED`, `PROVIDER_DEGRADED` |
| `emitPortableReconCues` | Maps findings → observation-only cue kinds (`reconciliationAttention` / `Conflict` / `Unknown`) |
| Cue-augmented providers | Ledger `reconFinding`, signal attention, lifecycle `meaningConflict`, payment duplicate/unknown preservation |
| `createDenaliCaseFactProvidersWithReconciliation` | Composes payment capability + recon without core changes |
| `HostReconciliationSession` | Ephemeral per-request classify cache — **not** Case persistence |

### Cue contract (Host)

| Cue kind | Meaning | Case channel |
| -------- | ------- | ------------ |
| `reconciliationAttention` | Discovery-only “look here” | `CaseSignalFactPort` attention |
| `reconciliationConflict` | Cross-source mismatch observed | `AuditCueFacts.reconFinding=mismatch` (+ `meaningConflict` when amount/money conflict) |
| `reconciliationUnknown` | Degraded / unread side — unknown preserved | TriFact `unknown` on affected payment facts; **not** coerced to unpaid/failure |

Forbidden cue language: “payment failed”, “refund required”, “finance owns it”.

### Proofs

See `reconciliation-classifier.spec.ts` — taxonomy emission, unknown preservation, no SoT writes, signal≠verdict, manual path, finance-core import boundary.

---

## PR11-C — Denali reconciliation + payment capability composition

```yaml
phase: PR11-C
module: apps/api/src/workspace-finance/case/compose-denali-case-providers.ts
status: IMPLEMENTED (Host Denali production composition · observational only)
```

### What shipped

| Artifact | Role |
| -------- | ---- |
| `composeDenaliCaseFactProviders` | Single Denali DI seam: SoT source → payment capability → optional recon → Case providers |
| `resolveDenaliCaseCapabilityFromEnv` | Host env: `FINANCE_CASE_PAYMENT_MODE`, `FINANCE_CASE_RECONCILIATION_ENABLED` |
| `DenaliCaseCapabilityConfig` | `paymentMode` + optional `PaymentGatewayPort` + recon flag (never enters finance-core) |
| Wired call sites | `createLiveDenaliCaseProvidersForTenant`, `runDenaliFinanceCaseShadow`, `loadEnrollmentCaseEncounter` |
| Taxonomy fixtures | Manual / online / outage / conflict scenarios for composition proofs |

### Pipeline (production)

```text
HostDenaliCaseReadSource (Denali SoTs)
        +
PaymentGatewayPort? (optional online)
        ↓
composeDenaliCaseFactProviders
        ↓
Payment capability selection (manual | online)
        ↓
Host reconciliation cues (optional)
        ↓
executeFinanceCase → interpret → EncounterView
```

### Defaults (safe)

| Setting | Default | Effect |
| ------- | ------- | ------ |
| Payment mode | `manual` | Existing Denali receipt/payment path |
| Reconciliation | off unless gateway injected or env enables | Manual remains unchanged |
| Gateway outage | unknown / degraded cues | Never unpaid coercion |

### Proofs

See `denali-case-composition.spec.ts` — manual parity, online+recon composition, outage unknown, no SoT mutation, EncounterView load path, finance-core clean.

| # | Deliverable | Section |
| - | ----------- | ------- |
| 1 | Reconciliation ownership | §1 |
| 2 | Fact categories | §2 |
| 3 | Conflict taxonomy | §3 |
| 4 | Resolution boundary | §4 |
| 5 | Multi-workspace portability | §5 |
| 6 | Placement vs payment capability | §6 |

---

## Final rule (canonical)

```text
Reconciliation compares clothing.
SoTs own the body.
Case only reads the tailored facts.
Never let the mirror sew the suit.
Unknown stays unknown when the mirrors disagree or fog over.
```

---

## Non-goals (PR11-A–C)

- Recon dashboard / ops UI exposure / UI mutation chrome  
- Auto-sync gateway → SoT / repair workflows  
- Capture / refund / chargeback from recon  
- New finance-core APIs (`reconcileCase`, etc.)  
- Expanding EncounterView contract for recon-specific panels (deferred product)  
- Changing interpreter laws to encode gateway brand conflicts  
- UI “one-click repair” bypassing Command Bridge  
- Retry engine / settlement automation  
- Persisting Host recon findings as Case rows  
- Hybrid multi-gateway marketplace routing  
