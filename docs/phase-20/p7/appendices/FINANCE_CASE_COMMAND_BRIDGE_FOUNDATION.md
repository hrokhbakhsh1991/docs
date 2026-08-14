# Finance Case Command Bridge Foundation (PR9-A)

```yaml
doc_id: FINANCE_CASE_COMMAND_BRIDGE_FOUNDATION
version: "2026-08-07-v2"
package: Host (apps/api workspace-finance) · finance-core vocabulary only
status: ARCHITECTURE + PR9-B PILOT
phase: PR9-A foundation · PR9-B Host reviewReceipt pilot
authority: >
  FINANCE_CASE_INTERPRETER_BOUNDARY · PR6-B Command Bridge Architecture ·
  PR8-B Read-only Operator Experience · existing FinanceService SoTs
related:
  - docs/phase-20/p7/appendices/FINANCE_CASE_COMMAND_BRIDGE.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_OPERATOR_READONLY_SURFACE.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_INTERPRETER_BOUNDARY.md
```

## Purpose

Define the **first safe bridge** from operator intent to **existing** SoT commands.

```text
Case remains a reader of truth.
SoTs remain owners of mutation.
```

PR9-A is **architecture + implementation planning only**. It does **not** ship bridge modules, UI mutation controls, new finance state, Case persistence, or payment-repair logic in Case.

**Continuity:** PR1 Interpreter → … → PR8 read-only Encounter UI → **PR9-A bridge foundation** (this doc) → future PR9-B Host implementation.

**Supersedes for planning detail:** this doc specializes [`FINANCE_CASE_COMMAND_BRIDGE.md`](./FINANCE_CASE_COMMAND_BRIDGE.md) (PR6-B) into a concrete first-wave foundation. PR6-B remains the canonical hard-lock architecture; PR9-A adds mapper shapes, first examples, and safety-proof plans.

---

## Hard locks (PR9-A)

### Inherited

| Lock | Meaning |
| ---- | ------- |
| finance-core does not mutate | No writes from core |
| Interpreter does not execute commands | Pure facts → CaseOutput |
| EncounterView does not own actions | Projection / hints only |
| UI does not call finance commands directly | Must go through Host bridge |
| No Case status persistence | No Case workflow replacement |
| No payment repair logic in Case | Repair remains SoT/product concern |

### PR9-A rules

| Rule | Meaning |
| ---- | ------- |
| Commands belong to existing SoTs | Case never becomes source of truth |
| Host owns authorization | Core has no actor permissions |
| Every mutation requires re-read | Never patch CaseOutput |
| Allow/forbid are hints | Not executable permissions |
| Failed command belongs to SoT | Case does not rollback |

---

## 1. Command bridge boundary

```text
Operator Intent
      │  (from future UX or automation — not PR8-B read-only shell mutation)
      ▼
Host Command Bridge
      │  authz + vocabulary gate + map
      ▼
Existing Finance / Workspace Command
      │  (FinanceService.reviewReceipt, submitReceipt, …)
      ▼
SoT validation + mutation
      │  commit | reject (SoT-owned)
      ▼
Fresh Case execution
      │  executeFinanceCase / projectCaseEncounter
      ▼
New EncounterView
```

### Forbidden edges

| Edge | Forbidden |
| ---- | --------- |
| UI → FinanceService / Prisma | Bypass Host bridge |
| finance-core → SoT write | Case writes truth |
| EncounterView.allow → auto-dispatch | Hints ≠ permissions |
| Patch CaseOutput after SoT success | Optimistic Case state |
| Case rollback after SoT failure | Case as TX manager |
| New settlement / lifecycle engines in Case | Scope creep |

### Boundary ownership (summary)

| Layer | Owns |
| ----- | ---- |
| **finance-core** | Meaning vocabulary, explanation, allow/forbid **hints** |
| **Host** | Actor, authorization, command mapping, audit context, re-execution |
| **SoT** | Validation, mutation, transaction truth |

---

## 2. Host command mapper (planned)

Conceptual Host module (names illustrative — **not implemented in PR9-A**):

```text
apps/api/src/workspace-finance/case/command-bridge/   # future PR9-B+
  types.ts                 CaseActionIntent, BridgeResult
  authorize-case-action.ts Host capability checks
  vocabulary-gate.ts       fresh EncounterView / CaseOutput allow|forbid
  map-case-action.ts       token + subjectKind → SoT invoker
  invoke-and-reexecute.ts  SoT call → mandatory re-execute
  audit.ts                 correlationId, actor, caseKey, sotResult
```

### Intent shape (planning)

```text
CaseActionIntent = {
  tenantId
  caseKey
  subjectKind
  subjectId                    // opaque
  actionToken                  // from CaseAllowAction vocabulary (hint)
  actor                        // Host auth principal
  correlationId
  sotHandles                   // e.g. receiptId, paymentId — product ids, not Case ids
  preflightExecutionId?        // optional freshness proof
}
```

### First-wave mapper table (evaluate only)

| Vocabulary hint (examples) | Host maps to existing SoT | Notes |
| -------------------------- | ------------------------- | ----- |
| `approve_evidence` / `reject_evidence` | `FinanceService.reviewReceipt` | Receipt review **completion** only |
| `inspect_evidence` | Deep-link / read path — **no mutation** in wave-1 if SoT has no inspect command | Display or navigate |
| Payment confirmation submission | Existing payment / receipt **submit** paths already on FinanceService (e.g. `submitReceipt`, manual payment confirm flows) | Must be **existing** ops — not a new Case settlement |
| `wait` / `leave` | No SoT call | No-op / dismiss chrome only |

### Explicitly out of first wave

| Do not add | Why |
| ---------- | --- |
| Settlement engine | New truth ownership |
| Lifecycle commands from Case | Booking/product FSM stays external |
| Automatic approvals | Dual-gate + human/automation intent required |
| `create_payment_repair` | Forbidden by Case vocabulary defaults; bridge must refuse |
| Marketplace payout / dispute engines | Deferred to later workspace mappers |

### Mapping algorithm (normative plan)

1. **Authorize** actor for the **SoT command** (not for “Case approve”).  
2. **Re-execute** (or validate TTL + SoT versions) → fresh CaseOutput / EncounterView.  
3. **Vocabulary gate:** intent token ∈ `allow` and ∉ `forbid` on **fresh** view.  
4. **Map** token → SoT invoker + args from `sotHandles`.  
5. **Invoke** SoT; capture result.  
6. **Re-execute** always after SoT attempt that may have mutated (and after successful commits; recommended after rejects for UX freshness).  
7. Return `{ sotResult, encounterView }` — never a patched prior CaseOutput.

---

## 3. Authorization boundary

```text
Actor identity + tenant
        │
        ▼
Host authorization (capabilities / roles / subject ACL)
        │  “May this actor call reviewReceipt for this receipt?”
        ▼
Vocabulary gate (fresh Case hints)
        │  “Is approve_evidence coherent right now?”
        ▼
SoT authorization + validation
        │  second wall — receipt state, idempotency, membership
        ▼
Mutation (SoT)
```

| Layer | Checks | Must not |
| ----- | ------ | -------- |
| Host authz | Capability to invoke **product** command | Treat `allow` as authz grant |
| Vocabulary gate | Coherence with current interpretation | Override SoT rejection |
| SoT | Legal mutation **now** | Trust Case as money authority |

finance-core **must not** implement actor permissions. UI **must not** hold SoT credentials or call command clients directly.

---

## 4. Re-execution lifecycle

```text
BEFORE
  FactSnapshot₀ → Interpreter → CaseOutput₀ → EncounterView₀

COMMAND (Host bridge)
  authz → vocabulary gate(CaseOutput_preflight) → SoT mutation

AFTER (mandatory)
  FactSnapshot₁ → Interpreter → CaseOutput₁ → EncounterView₁
```

| Rule | Detail |
| ---- | ------ |
| No patch | Do not merge “receipt approved” into CaseOutput₀ |
| No Case lifecycle | No CaseApproved / CaseCompleted status |
| Freshness | Prefer interpret-at-intent **and** interpret-after-mutation |
| Observation | Shadow/calibration may observe; must not block SoT |

---

## 5. Failure model

| Failure | Behavior | Case role |
| ------- | -------- | --------- |
| Authz denied | No SoT call; Host error | None |
| Vocabulary gate fail | No SoT call; show fresh EncounterView | Advisory only |
| SoT rejects | SoT error to Host; optional re-execute | New view reflects unchanged/partial SoT |
| Concurrent / stale | Abort or SoT conflict; refresh EncounterView | No Case rollback |
| Partial SoT saga | Owned by SoT outbox/TX | Case must not compensate |
| Bridge / mapper bug | Fail closed; no mutation | Log correlationId |

**Failed commands do not create Case state** — there is no Case row to update. Success only changes SoT truth; Case meaning updates solely via re-execution.

---

## 6. Safety proofs (required when implementing)

| Proof | Plan |
| ----- | ---- |
| UI cannot bypass Host bridge | Import/boundary guard: `@app-tour/finance-case-encounter-ui` and apps/web finance Case UI must not import FinanceService command clients; mutation entry only via Host bridge module / BFF route |
| Case cannot write SoTs | finance-core `guard:boundary` + no command ports in `./case`; encounter UI presentation guard remains |
| Commands require authorization | Unit tests: missing capability → no SoT mock call |
| Failed commands do not create Case state | After SoT reject: assert no Case repository/table writes; CaseOutput only from re-execute |
| Successful commands produce fresh interpretation | After SoT success mock: `executionId` / reading may change; object identity ≠ patched prior CaseOutput |

PR9-A documents these proofs; **PR9-B+** implements them with tests.

---

## 7. Future workspace portability

Same bridge contract; different Host mapper tables.

| Probe | First-wave relevance | Later mapper |
| ----- | -------------------- | ------------ |
| **A Enrollment** | Receipt review + payment/receipt submit (Denali FinanceService) | Primary pilot |
| **B Subscription** | Online payment confirm / invoice retry via billing SoT | After A proves dual-gate |
| **C Marketplace** | Buyer payment confirm; payout/dispute **separate caseKeys** | Separate mapper rows; never merge |

Portability rules:

- finance-core vocabulary stays product-agnostic  
- Host owns per-workspace `map-case-action` tables  
- UI shell (PR8-B) gains intent chrome only after Host bridge exists — still no direct SoT calls  

---

## 8. Deliverables checklist

| # | Deliverable | Section |
| - | ----------- | ------- |
| 1 | Command bridge boundary | §1 |
| 2 | Host command mapper (plan) | §2 |
| 3 | Authorization boundary | §3 |
| 4 | Re-execution lifecycle | §4 |
| 5 | Failure model | §5 |
| 6 | Future workspace portability | §7 |

---

## Implementation readiness verdict

| Item | Status |
| ---- | ------ |
| PR6-B architecture locks | Ready |
| PR9-A foundation plan (this doc) | **Ready** |
| Host bridge code | **Not started** — next implementation PR |
| UI mutation controls | **Not started** — blocked on Host bridge |
| Case persistence | **Forbidden** |
| Settlement / lifecycle / auto-approve | **Forbidden** in foundation |

**Verdict:** Foundation is sufficient to authorize a **Host-only** PR9-B implementation for enrollment receipt review + existing payment/receipt submit paths behind dual-gate + re-execution. This document alone ships **no code**.

---

## PR9-B — Host `reviewReceipt` pilot (implemented)

```yaml
phase: PR9-B
module: apps/api/src/workspace-finance/case/command-bridge/
status: IMPLEMENTED (Host-only · reviewReceipt only)
```

### What shipped

| Artifact | Role |
| -------- | ---- |
| `ReviewReceiptBridgeIntent` | Intent contract (hint token + SoT handles + actor) |
| `authorizeCaseCommand` | Host operator authz gate |
| `assertReviewReceiptVocabulary` | Fresh CaseOutput allow/forbid gate |
| `mapReviewReceiptIntent` | Token → `FinanceService.reviewReceipt` args |
| `runReviewReceiptCommandBridge` | Authz → vocab → SoT → mandatory re-execute → EncounterView |
| `loadEnrollmentCaseEncounter` | Host executeFinanceCase + projectCaseEncounter |

### Hard locks held

- Only `reviewReceipt` (approve / reject evidence)
- No UI mutation chrome
- No Case persistence / history
- No payment settlement / lifecycle / auto-approve / payment repair
- finance-core Case remains read-only meaning

### Safety proofs

See `finance-case-command-bridge.spec.ts` — UI bypass scan, authz required, vocab gate, SoT failure creates no Case state, success refreshes EncounterView, determinism of vocabulary gate.

---

## Final rule (canonical)

```text
Operator asks.
Host authorizes and maps.
SoT mutates and validates.
Host re-reads and re-interprets.

Case explains the world.
Case never owns the world.
```

---

## Non-goals (PR9-A)

- Implementing command-bridge TypeScript modules  
- UI approve/reject buttons or mutation chrome  
- New finance state / Case tables / Case status  
- Settlement engine, lifecycle commands, automatic approvals  
- Payment repair logic inside finance-core Case  
- Changing interpreter laws or EncounterView meaning  
