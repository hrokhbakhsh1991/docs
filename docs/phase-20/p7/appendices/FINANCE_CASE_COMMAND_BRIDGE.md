# Finance Case Command Bridge Architecture (PR6-B)

```yaml
doc_id: FINANCE_CASE_COMMAND_BRIDGE
version: "2026-08-08-v11"
package: "@app-tour/finance-core"
module: src/case/ (vocabulary only) · Host (bridge) · SoT services (mutation) · Web (UX + reviewReceipt command UI)
status: ARCHITECTURE
phase: PR6-B…PR18-C validated · PR19 controlled production observation
authority: >
  FINANCE_CASE_INTERPRETER_BOUNDARY · Interpreter Rules v1 ·
  Port Contracts v1 · PR6-A Encounter View · existing FinanceService / lifecycle SoTs ·
  PR17 Commercial Meaning (read) · ADR Decision A · PR18-A UX architecture · PR18-B UI
related:
  - docs/phase-20/p7/appendices/FINANCE_CASE_INTERPRETER_BOUNDARY.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_COMMAND_BRIDGE_FOUNDATION.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_OPERATOR_EXPERIENCE.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_VALIDATION_RUNBOOK.md
  - scripts/pr18c-denali-command-ui-smoke.sh
  - apps/web/src/finance/finance-command-bridge-ux-architecture.ts
  - apps/web/src/finance/finance-case-command-review-receipt-ui.tsx
  - apps/web/src/finance/finance-case-command-ui-rollout.ts
```

## Purpose

Answer:

> How can a human or automation act on a Case interpretation **without** making Case the owner of business truth?

This document designs the **Command Bridge** boundary: the future path by which *approved Case action vocabulary* re-enters **existing** System-of-Truth (SoT) command services safely.

**This phase produces architecture only.** No code, schema, API, UI, workflow engine, Case repository, or Case status.

**Foundation planning (first-wave mapper + safety proofs):** [`FINANCE_CASE_COMMAND_BRIDGE_FOUNDATION.md`](./FINANCE_CASE_COMMAND_BRIDGE_FOUNDATION.md) (PR9-A).

---

## Hard locks (PR6-B)

### Inherited

| Lock | Meaning |
| ---- | ------- |
| CaseOutput ephemeral | Never a DB row, never patched in place |
| No Case repository / table / status | No `case_status`, no “Case completed” |
| Interpreter pure + read-only | Facts in → CaseOutput out; never mutates |
| FactSnapshot sole interpreter input | No signal-driven verdict; signals ≠ verdict |
| Lifecycle external | Product lifecycle FSM stays outside Case |
| Execution = orchestration only | Assemble → interpret → diagnostics |
| Adapters translate only | No interpretation in Denali/host mappers |
| finance-core ↛ workspaces | No product command imports in core |
| Commands never originate new business truth | Mutations land only in existing SoTs |

### New

| Lock | Meaning |
| ---- | ------- |
| `allow` / `forbid` ≠ command | Vocabulary / policy hint only — not an executable |
| Interpreter never executes | No side effects from `interpretFinanceCase` |
| EncounterView never owns commands | PR6-A projection stays read-only |
| Commands target existing SoTs only | Receipt, payment, booking lifecycle, billing, payout, dispute services already in product |
| Every mutation → re-read + re-execute | Fresh FactSnapshot → new CaseOutput; **no** optimistic Case state |
| Host owns authorization | Actor / capability / tenant checks before bridge dispatch |
| Target SoT owns validation | SoT accepts or rejects the mutation; Case does not override |

---

## 1. Command ownership matrix

| Concern | Owner | Must not own |
| ------- | ----- | ------------ |
| **Interpretation meaning** | finance-core interpreter | Host UI, bridge, SoT adapters |
| **Action vocabulary** (`allow` / `forbid`) | finance-core CaseOutput | Host inventing alternate verdicts |
| **Command intent** (operator/automation chooses to act) | Host / Operator | Interpreter, EncounterView |
| **Authorization** (may this actor attempt this SoT command?) | Host (authz / capabilities) | finance-core, CaseOutput |
| **Vocabulary → SoT command mapping** | Host Command Bridge | finance-core (no Denali/Prisma imports) |
| **Validation** (is this mutation legal *now*?) | Target SoT service | Case, bridge inventing business rules |
| **Mutation / transaction** | Target SoT (+ its DB / outbox) | finance-core, Case “transaction manager” |
| **Re-snapshot** (read facts after mutation) | Host (Case read providers) | Patching prior CaseOutput |
| **Re-execution** | Host → `executeFinanceCase` / shadow path | Interpreter calling itself after write |
| **Presentation** | EncounterView (PR6-A) | Commands, SoT writes |

```text
Operator / Host automation
        │  intent + authz
        ▼
   Command Bridge          ← Host-owned; maps vocabulary → product commands
        │  validated call
        ▼
 Existing SoT Command Services
   (FinanceService, booking lifecycle, billing, payout, dispute, …)
        │  mutation committed (or rejected) in SoT
        ▼
   Re-read Fact providers
        ▼
   executeFinanceCase / interpret
        ▼
   New ephemeral CaseOutput
        ▼
   projectCaseEncounter (optional)
```

**Rule:** Case never “approves money,” “settles payment,” or “changes lifecycle.” It may *allow* an operator to *invoke* an existing SoT workflow that already knows how to do those things under SoT rules.

---

## 2. Action vocabulary boundary

### What the interpreter expresses

`CaseOutput.allow` / `CaseOutput.forbid` (and EncounterView passthrough) are **portable action tokens**, not RPC methods.

They answer: *given these facts, which postures are coherent / incoherent for an operator or automation?*

They do **not** answer: *execute payment X* or *write row Y*.

### Allowed class (illustrative mapping targets)

| Vocabulary token (examples) | Meaning as hint | Legitimate SoT target (product-owned) |
| --------------------------- | --------------- | ------------------------------------- |
| `inspect` / `inspect_evidence` | Open evidence for review | Existing receipt/evidence inspect UX → SoT read + optional review command |
| `approve_evidence` / `reject_evidence` | Evidence decision is coherent | **Existing** `reviewReceipt` / equivalent — SoT validates receipt state |
| `wait` / `leave` | Do not mutate; wait for counterparty | No command (or soft “snooze” host preference only — not Case state) |
| `escalate` / `investigate` | Exception / audit path | Host routing to exception desk tools; SoT investigation commands if they already exist |
| `handoff_product` | Product desk owns next step | Product/lifecycle tools — **not** Case inventing lifecycle transitions |
| `exit_audit_to_case` | Leave audit altitude | Host encounter mode change only — **not** a money mutation |

Host may also map host-local intents such as “request missing evidence” or “retry payment synchronization” **only** when those map onto existing SoT/support commands (notification, payment sync job, etc.) and remain outside finance-core.

### Forbidden class (never bridgeable from Case)

| Anti-pattern | Why forbidden |
| ------------ | ------------- |
| “Approve money because Case `allow` contains …” | Money truth lives in payment/obligation SoT; Case does not authorize settlement |
| Change lifecycle from Case | Lifecycle FSM is product-owned |
| Settle / capture / refund from finance-core Case | Ledger/payment SoTs own capture semantics |
| Mutate ownership / invent Case owner timeline | Owner is ephemeral interpretation, not a writable entity |
| Create payment repair as default Case action | Already forbidden by interpreter defaults; bridge must not invent repair as Case power |
| Treat `forbid` as soft advisory only when Host wants convenience | Host must refuse dispatch when token is in `forbid` **or** when SoT rejects |

### Dual-gate rule

A Host command may proceed only if **both**:

1. **Vocabulary gate (Host):** requested bridge action is consistent with current CaseOutput `allow` / not in `forbid` (for the CaseKey just interpreted), **and**
2. **SoT gate:** target service validates current SoT state and actor permissions.

Fail either gate → no mutation attributed to Case.

---

## 3. Dependency diagram

```text
┌─────────────────────────────────────────────────────────────┐
│ finance-core (@app-tour/finance-core/case)                 │
│  facts → assemble → interpret → CaseOutput                  │
│  projectCaseEncounter → EncounterView                       │
│  exports: portable allow/forbid vocabulary (types + values) │
│  FORBIDDEN: Denali, Prisma, command ports, mutations        │
└────────────────────────────┬────────────────────────────────┘
                             │ produces vocabulary + CaseOutput
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ Host (apps/api workspace-finance, future operator surface)  │
│  Command Bridge:                                            │
│    authz → map token → SoT command args → invoke SoT        │
│    on success/fail → re-assemble providers → re-execute     │
│  FORBIDDEN: treating CaseOutput as workflow state store     │
└───────────────┬─────────────────────────────▲───────────────┘
                │ invokes                      │ re-reads facts
                ▼                              │
┌─────────────────────────────────────────────────────────────┐
│ Product SoTs / existing command services                    │
│  FinanceService (receipt/payment), booking lifecycle,       │
│  billing, payout, dispute, …                                │
│  Owns: validation, mutation, idempotency, accounting truth  │
└─────────────────────────────────────────────────────────────┘

Workspace adapters (Denali / future B / C):
  SoT DTO → portable facts (read)     ✅
  Host maps vocabulary → workspace commands  ✅
  finance-core → workspace command           ❌
  UI → database                              ❌
  CaseOutput → workflow state machine        ❌
  Interpreter → mutation                     ❌
```

### Dependency direction (frozen)

| Edge | Allowed? |
| ---- | -------- |
| finance-core → allow/forbid vocabulary | ✅ |
| Host → finance-core `./case` (read/execute/project) | ✅ |
| Host → existing SoT command APIs | ✅ |
| SoT → DB / outbox | ✅ (SoT’s own) |
| finance-core → Denali command | ❌ |
| finance-core → Prisma | ❌ |
| Interpreter → mutation | ❌ |
| EncounterView → command dispatch | ❌ |
| UI → database | ❌ |
| CaseOutput → persisted workflow state | ❌ |

---

## 4. Host command mapping architecture

### Bridge responsibilities (Host module — future)

Conceptual components (names illustrative; **not** implemented in PR6-B):

1. **`CaseActionIntent`** — operator/automation request: `{ caseKey, actionToken, actor, correlationId, optional sotHandles }`
2. **`CaseCommandAuthorizer`** — Host authz: tenant, capability, subject access
3. **`CaseVocabularyGate`** — compare intent token to **fresh** CaseOutput `allow`/`forbid` (see staleness)
4. **`CaseActionMapper`** — product-specific: token + subjectKind → concrete SoT method + args
5. **`SoTCommandInvoker`** — calls existing services only; returns SoT result
6. **`CaseReexecutionRunner`** — always: re-read providers → `executeFinanceCase` → optional Encounter projection + observation

### Mapping principle

```text
CaseAllowAction token
  → (subjectKind, workspace) mapper table on Host
  → existing command (e.g. FinanceService.reviewReceipt)
  → NEVER a new “CaseApprove” entity
```

Mappers are **workspace-owned** (Denali enrollment vs subscription vs marketplace). finance-core ships only the shared token vocabulary.

### Staleness / concurrency preflight

Before vocabulary gate:

1. Host re-runs execution (or uses a CaseOutput whose `executionId` / fact digests are still within an explicit short TTL **and** SoT version tokens match).
2. Preferred path: **always** re-execute immediately before dispatch (“interpret-at-intent”), then gate, then mutate, then re-execute again (“interpret-after-mutation”).

No optimistic UI Case state. UI may show last EncounterView as **hint** only until refresh.

---

## 5. Re-execution lifecycle

```text
BEFORE
  FactSnapshot  →  Interpreter  →  CaseOutput₀  →  EncounterView₀ (optional)

COMMAND
  Host authz + vocabulary gate(CaseOutput₀ or CaseOutput_preflight)
    → SoT mutation (commit | reject)

AFTER (mandatory on any attempted bridge path that reached SoT, and recommended even on authz deny for audit UX)
  New SoT state
    → New FactSnapshot
    → Interpreter
    → CaseOutput₁   ← never a patch of CaseOutput₀
    → EncounterView₁
```

### Non-negotiables

| Rule | Detail |
| ---- | ------ |
| No patch | Do not merge “receipt approved” into old CaseOutput fields |
| No Case lifecycle | There is no CaseApproved / CaseCompleted status to flip |
| Observation optional | Shadow/comparison/calibration may observe both sides; must not gate SoT success |
| Failure still re-reads when useful | If SoT rejects, re-execution shows current truth (may still be prior reading) |

---

## 6. Failure handling model

| Failure | Behavior | Case role |
| ------- | -------- | --------- |
| **Authorization denied** | Host returns deny; **no** SoT call | None — no mutation |
| **Vocabulary gate fail** | Host refuses; log `forbid` / missing `allow` | CaseOutput remains advisory evidence in logs only |
| **Command rejected by SoT** | SoT error surfaces to Host; business rules unchanged | Re-execute → new CaseOutput reflecting unchanged (or partially updated) SoT |
| **Concurrent mutation** | SoT optimistic lock / version conflict | Re-execute; operator retries against new EncounterView |
| **Stale CaseOutput** | Preflight re-execute disagrees with UI hint | Abort command; show CaseOutput_preflight |
| **Payment already changed** | SoT idempotent success or conflict | Re-execute; do not invent Case rollback |
| **Lifecycle changed externally** | SoT / booking FSM already moved | Facts show `NOT_ELIGIBLE` / closed cues; Case interprets; no Case undo |
| **Partial success** (multi-step SoT) | Owned entirely by SoT saga/outbox | Case must not compensate; re-execute after SoT settles |

### Explicitly avoided

- finance-core rollback / distributed transactions across SoTs
- Hidden “pending Case command” workflow state
- Case as transaction manager or outbox owner
- Treating bridge failure as CaseOutput mutation

---

## 7. Security / auth boundary

```text
Actor identity + tenant
        │
        ▼
Host authorization (capabilities / roles / subject ACL)
        │
        ▼
Vocabulary gate (fresh CaseOutput allow/forbid)
        │
        ▼
SoT authorization + validation (second wall)
        │
        ▼
Mutation
```

| Layer | Checks |
| ----- | ------ |
| Host | Is actor allowed to attempt this **product** command for this tenant/subject? |
| Vocabulary | Is this action coherent with **current** interpretation? |
| SoT | Is receipt/payment/lifecycle state legally mutable **now**? Idempotency key? |

finance-core **must not** implement actor authz. EncounterView **must not** embed capability grants. Logs may record `caseKey`, `executionId`, action token, authz outcome — never a Case status row.

---

## 8. A / B / C portability validation

Same bridge contract; different Host mappers + SoT surfaces.

| Probe | Subject binding | Example vocabulary → SoT mapping | Same laws? |
| ----- | --------------- | -------------------------------- | ---------- |
| **A Enrollment** | registration → subject; member → counterparty; receipt → evidence | `approve_evidence` → `reviewReceipt`; payment sync retry → existing payment sync job | ✅ |
| **B Subscription** | billing cycle / recurring intent | invoice retry / dunning correction → billing SoT commands; may use `wait` without offline receipt | ✅ |
| **C Marketplace** | **separate** caseKeys for buyer payment, seller payout, dispute | Each CaseKey maps to its SoT command family; **no** merged owner across cases | ✅ |

Portability requirements:

- finance-core vocabulary remains product-agnostic tokens
- Host maintains per-workspace mapper tables
- Never one CaseOutput spanning buyer+seller+dispute
- Re-execution always scoped by `caseKey` + subjectKind

---

## 9. Implementation readiness verdict

| Item | Status |
| ---- | ------ |
| Interpreter / CaseOutput vocabulary | **Ready** (exists) |
| Encounter projection | **Ready** (PR6-A) |
| Host read adapters + shadow/observation | **Ready** (Denali A path) |
| Command Bridge architecture | **Ready (this doc + PR14-A)** |
| Command Bridge **Host contracts** | **Ready (PR9-B pilot + PR14-A intent/stale/failures)** — `reviewReceipt` only |
| Command Bridge UI / mutation HTTP productization | **Not started** — deferred |
| Case repository / status | **Forbidden** |
| Case command ports inside finance-core | **Forbidden** |
| UI action wiring | **Deferred** (after intentional mutation endpoint) |
| B/C SoT mappers | **Deferred** (after A enrollment bridge proves dual-gate) |

### Recommended implementation sequence (future — not this PR)

1. Host-only module: vocabulary gate + mapper stubs + re-execution harness (no UI)
2. Wire **one** Denali SoT command (e.g. receipt review) behind dual-gate
3. Proofs: authz deny, SoT reject, stale CaseOutput, post-mutation new CaseOutput ≠ patched old
4. Expand mapper table; never expand finance-core into commands
5. UI binds to EncounterView + Host bridge API (later phase)

### Verdict

**Architecture is ready to gate implementation.**  
**Implementation is not authorized by this PR.**  
finance-core remains interpretation + projection only; business truth stays in SoTs; the bridge is a Host-owned dual-gate adaptor, not a Case workflow engine.

---

## Final rule (canonical)

```text
Case interprets.
Host authorizes and maps.
SoT mutates and validates.
Host re-reads and re-interprets.

CaseOutput.allow is permission to *ask* an existing SoT —
never permission to *become* the SoT.
```

---

## Non-goals (PR6-B)

- Implementing Command Bridge modules, ports, or HTTP
- Prisma / Case tables / Case status enums
- Workflow engine / saga owned by Case
- UI buttons or operator inbox
- Expanding interpreter to “execute allows”
- finance-core importing workspace command surfaces
- Optimistic Case state machines

---

## PR14-A — Production Command Bridge architecture

**Goal shift**

```text
Before: Case explains finance state
After:  Operator intent → Host authorization → Existing SoT command → Fresh Case interpretation
```

Case still **never mutates**. EncounterView remains **read-only**. finance-core remains **read/interpret only**. Existing FinanceService (and future workspace SoT ports) remain mutation SoT owners.

### Production control flow

```text
EncounterView hint (allow/forbid only)
        ↓
Operator Intent  (CaseCommandIntent — Host-owned; not a permission)
        ↓
Host Command Bridge
        ↓
Authorization     (operator · tenant · workspace capability)
        ↓
Vocabulary gate   ("Does current Case meaning allow this intent?" — not authz)
        ↓
Stale protection  (reload Encounter; compare source execution id / caseKey)
        ↓
Existing SoT command  (e.g. FinanceService.reviewReceipt)
        ↓
Fresh FactSnapshot
        ↓
executeFinanceCase
        ↓
New EncounterView   (never patch prior CaseOutput / EncounterView)
```

### Ownership (production)

| Concern | Owner | Forbidden owner |
| ------- | ----- | --------------- |
| Meaning / vocabulary | finance-core interpreter | Host UI, bridge, SoT adapters |
| Operator intent | Host (`CaseCommandIntent`) | EncounterView, finance-core |
| Authorization | Host | Case vocabulary, finance-core |
| Vocabulary coherence gate | Host bridge reading **fresh** CaseOutput | Host inventing alternate allow/forbid |
| Mutation validation + write | Existing SoT command | Case, EncounterView, bridge “transaction” |
| Re-snapshot + re-execute | Host | Patching old CaseOutput |
| Presentation | EncounterView (read-only) | Command dispatch |

### `CaseCommandIntent` (architecture contract)

Intent is **not** permission. It carries operator choice + provenance for stale checks:

| Field | Role |
| ----- | ---- |
| `caseKey` | Subject binding for re-execution |
| `actor` | Operator identity context (authz input) |
| `action` | Supported command + action token (`reviewReceipt` + `approve_evidence` \| `reject_evidence`) |
| `workspace` | `workspaceId` + `tenantId` (capability / tenancy) |
| `source` | Source Encounter `executionId` (+ optional version hint) for stale comparison |
| `correlationId` | Audit / telemetry correlation |
| command payload | SoT-specific ids (receipt, registration, …) — never Case status |

### Authorization vs vocabulary

| Gate | Question | Outcome if fail |
| ---- | -------- | --------------- |
| **Host authorization** | May this actor attempt this product command for this tenant/workspace? | `auth_denied` — **before** mutation |
| **Case vocabulary gate** | Does **current** Case meaning allow this action token? | `vocabulary_denied` — **before** mutation |
| **SoT** | Is the mutation legal *now* under product rules? | `sot_rejected` — SoT remains authority; no Case rollback |

Vocabulary **does not** authorize. Authorization **does not** invent Case meaning.

### Stale protection

**Before mutation**

1. Reload current Encounter (fresh FactSnapshot → executeFinanceCase → EncounterView).
2. Compare `intent.caseKey` to fresh `caseOutput.caseKey`.
3. When `source.encounterVersionHint` is set (Host meaning fingerprint stamped at GET time), require equality with `caseOutputMeaningFingerprint(fresh)`.
4. Otherwise require `source.encounterExecutionId === fresh.executionId` (correlational / test mode).
5. Reject with `concurrency_conflict` if mismatched — **no SoT call**.

**After mutation**

1. Reload facts from SoTs.
2. `executeFinanceCase` again.
3. Return **new** EncounterView / CaseOutput.
4. **Never** patch the preflight output in place.

### Failure model (PR14-A)

| Code | Meaning | Case state? |
| ---- | ------- | ----------- |
| `auth_denied` | Host authorization failed | None created |
| `vocabulary_denied` | Fresh Case allow/forbid rejects token | None created |
| `sot_rejected` | Target SoT rejected mutation | None; SoT authority |
| `concurrency_conflict` | Stale intent (source Encounter changed) | None; no mutation |
| `provider_unavailable` | Fact / Encounter providers failed before safe mutate | None |
| `intent_invalid` | Malformed intent (token/decision mismatch, missing ids) | None |
| `reexecute_failed` | Post-mutation re-interpret failed (SoT may already have written) | None in Case; SoT remains authority — **no Case rollback** |

Rules: no Case status row; no Case-owned saga rollback; failures never invent Case persistence.

### Supported commands (PR14-A)

| Command | Actions | SoT (Denali) | SoT (future workspace) |
| ------- | ------- | ------------ | ---------------------- |
| `reviewReceipt` | `approve_evidence`, `reject_evidence` | `FinanceService.reviewReceipt` | Workspace-injected port with same bridge contract |

### Forbidden mutations (explicit)

Do **not** bridge in PR14-A:

- payment capture
- refund
- settlement
- lifecycle transition
- ownership changes
- bulk operations
- automatic / scheduled actions
- any finance-core write

### Portability

Same Host bridge contract:

```text
CaseCommandIntent
  → Host authz + vocabulary + stale
  → ReviewReceiptSoTPort.reviewReceipt(...)   ← workspace injects implementation
  → fresh Encounter
```

- **Denali:** port → `FinanceService.reviewReceipt`
- **Future workspace:** port → workspace-specific SoT command
- **finance-core:** unchanged — no command imports

### Security boundaries

| Boundary | Rule |
| -------- | ---- |
| Encounter UI | Read-only; must not import / call SoT commands |
| finance-core | No SoT command imports; vocabulary only |
| Host bridge | Sole path from intent → SoT for Case-hinted actions |
| Authz | Always before mutation |
| Case | Cannot mutate; cannot own workflows; cannot persist |

### PR14-A ship / non-ship

**Ships:** Host architecture contracts (`CaseCommandIntent`, failure taxonomy, stale guard), production docs, proofs 1–8, alignment of existing PR9-B `reviewReceipt` pilot runner with stale + failure model.

**Does not ship:** UI action buttons, public mutation HTTP endpoint productization, bulk ops, auto actions, additional command categories.

### Required proofs (PR14-A)

1. finance-core imports no commands  
2. Encounter UI cannot invoke SoT directly  
3. Authorization happens before mutation  
4. Case cannot mutate state  
5. Successful command creates fresh Case interpretation  
6. Stale intent is rejected  
7. Denali path unchanged (`reviewReceipt` → FinanceService)  
8. Second workspace compatibility preserved (injectable SoT port; no Denali imports in core)

---

## PR14-B — Host Command Bridge production wiring (`reviewReceipt`)

### First production command lifecycle

```text
GET EncounterView (+ meaningFingerprint + commandCapability metadata)
        ↓
Operator Intent (HTTP body — intent only; actor from session)
        ↓
POST /finance/case/commands/review-receipt   ← finance-http owned
        ↓
Host: authz → preflight Encounter → stale → vocabulary
        ↓
FinanceService.reviewReceipt (SoT only)
        ↓
Postflight Encounter → presentation DTO
        ↓
HTTP: fresh EncounterView + executionId  |  typed failure (no SoT leakage)
```

### HTTP ownership

| Concern | Owner |
| ------- | ----- |
| Route / handler | `@app-tour/finance-http` (`handleFinanceCaseCommandReviewReceipt`) |
| Intent + response contracts | `@app-tour/finance-http-contracts` |
| Bridge execution + SoT adapter + telemetry | `apps/api` workspace-finance Host |
| Mutation truth | Existing `FinanceService.reviewReceipt` |
| Presentation | Encounter DTO only — never CaseOutput / FactSnapshot |

**Rule:** UI never posts raw SoT command shapes. Body is `CaseCommandIntent`-shaped (command + token + source Encounter provenance + receipt ids). Actor / tenant come from resolved session — body actor fields are ignored if present.

### Security model

| Control | Behavior |
| ------- | -------- |
| Session authz | `assertOperatorAccess` before any SoT call |
| Tenant binding | Intent workspace/tenant must match session |
| Vocabulary | Fresh Case `allow`/`forbid` only |
| Stale | Meaning fingerprint and/or source execution id |
| Response | Presentation on success; typed public codes on failure |
| Leakage | No Prisma / gateway / internal SoT error strings to client |
| UI | Capability metadata only — no buttons in this PR |

### Rollback behavior

| Failure | Mutation? | Case rollback? | Client sees |
| ------- | --------- | -------------- | ----------- |
| `auth_denied` | No | N/A (no Case state) | 403 typed |
| `vocabulary_denied` | No | N/A | 409 typed |
| `concurrency_conflict` (stale) | No | N/A | 409 typed |
| `intent_invalid` | No | N/A | 400 typed |
| `sot_rejected` | SoT rejected (unchanged) | None — SoT authority | 409 typed |
| `provider_unavailable` | No (preflight) | N/A | 503 typed |
| `reexecute_failed` | **SoT may have written** | **No Case rollback** — re-GET Encounter | 503 typed |

SoT remains authority. Case never invents compensating transactions.

### Supported command list (production)

| HTTP | Command | Tokens | SoT |
| ---- | ------- | ------ | --- |
| `POST /finance/case/commands/review-receipt` | `reviewReceipt` | `approve_evidence`, `reject_evidence` | `FinanceService.reviewReceipt` |

Still forbidden: payment capture, refund, settlement, lifecycle, ownership, bulk, auto-actions.

### Audit observation (fail-open)

Host telemetry events (no audit persistence, no Case history):

- `command_requested`
- `auth_denied`
- `vocabulary_denied`
- `stale_rejected`
- `sot_rejected`
- `succeeded`

Sink failures must not fail the HTTP mutation path.

### UI integration seam (not full UX)

GET Encounter may include:

- `meaningFingerprint` — for stale intent
- `commandCapability` — which Case-hinted tokens are currently available for `reviewReceipt`

UI consumes EncounterView + capability metadata only. **No buttons / workflows / auto-clicks** in PR14-B.

### PR14-B ship / non-ship

**Ships:** Host HTTP command endpoint, FinanceService adapter, fail-open telemetry, presentation success/failure contracts, UI capability metadata, security proofs 1–8.

**Does not ship:** UI buttons, bulk approval, autonomous actions, other command categories, Case persistence.

---

## PR18-A — Command Bridge UX Architecture (no buttons)

**Scope:** Architecture only. No mutation UI, no FinanceService changes, no finance-core changes, no Case persistence.

Commercial Meaning (PR17) is the operator **read** surface. PR18-A defines how a future Command Bridge **UX** may attach to Meaning without collapsing discovery, permission, intent, and SoT execution into one control.

### 1. Command surface contract

```text
Commercial Meaning (EncounterView)
        │
        ├─ commandCapability  →  DISCOVERY (what tokens are Case-coherent now)
        ├─ meaningFingerprint + executionId  →  STALE PROVENANCE (intent binding)
        │
        ▼  (future UX — not shipped)
   Operator forms CaseCommandIntent
        │
        ▼
   Host Command Bridge (existing POST)
        │  authz ≠ capability
        │  vocabulary gate ≠ authz
        │  stale guard ≠ vocabulary
        ▼
   FinanceService (SoT mutation authority)
        │
        ▼
   Fresh Encounter GET (new executionId)
```

| Layer | Source | Answers | Does not answer |
| ----- | ------ | ------- | --------------- |
| **Capability discovery** | `commandCapability` on Encounter OK | Which Case `allow` tokens map to known bridge commands *for this reading* | May this actor mutate? |
| **Permission** | Host session authz (`assertOperatorAccess`) | May this operator attempt a bridge command? | Is the token Case-coherent? |
| **Command intent** | Operator choice + provenance (`CaseCommandIntent`) | What action do they want, against which Encounter snapshot? | Execute / commit |
| **Execution** | Host bridge → FinanceService | SoT accept/reject | Case “approval” as truth |

**Rules:**

1. `commandCapability.availableTokens` is **hint metadata** derived from Encounter `allow` — never a grant.
2. UI must treat empty tokens as “no coherent Case-hinted action,” not as authz denial (and vice versa).
3. Intent is assembled only from presentation + operator choice + `executionId` / `meaningFingerprint` — never from SoT DTOs or CaseOutput.
4. Execution remains solely `POST /finance/case/commands/review-receipt` (PR14-B); UI never calls FinanceService or gateway SDKs.

First-wave surface (unchanged):

| Command | Tokens | Endpoint |
| ------- | ------ | -------- |
| `reviewReceipt` | `approve_evidence`, `reject_evidence` | `/finance/case/commands/review-receipt` |

Forbidden mutation classes remain: payment capture, refund, settlement, lifecycle, ownership, bulk, automatic actions.

### 2. Operator action model

#### Action lifecycle (future UX must follow)

| Phase | Operator sees | System does | Mutation? |
| ----- | ------------- | ----------- | --------- |
| **Discover** | Capability tokens + Meaning reading | GET Encounter | No |
| **Select** | Proposed token / decision (preview only) | Local draft intent — not posted | No |
| **Confirm** | Explicit confirm chrome (required for approve/reject) | Bind `executionId` + optional `meaningFingerprint` into intent | No |
| **Submit** | In-flight / disabled controls | POST Command Bridge | Attempt |
| **Resolve** | Success → fresh Meaning; or typed failure | Authz / vocabulary / stale / SoT / re-execute paths | Only if SoT accepted |
| **Refresh** | New Meaning (`executionId` changed) | Re-GET Encounter; never patch prior Encounter fields | No (read) |

#### Confirmation requirements

- Approve / reject evidence: **hard confirm** (two-step) before POST.
- Confirm copy must show: registration subject (opaque id), token, decision, and that SoT remains authority.
- No “one-click” from capability list; capability list is not an action affordance until a dedicated Command UI PR.

#### Stale Encounter handling

| Signal | UX behavior |
| ------ | ----------- |
| `CASE_COMMAND_STALE` / concurrency | Block retry with same provenance; force Meaning refresh; re-bind intent to new `executionId` / fingerprint |
| Local draft older than last viewed Meaning | Discard or re-confirm after refresh |
| Capability tokens changed after refresh | Re-run discovery; do not reuse prior token silently |

#### Permission failures

| Code | UX | Inference |
| ---- | -- | --------- |
| `CASE_COMMAND_AUTH_DENIED` | Permission failure; not “Case forbids” | Authz only — do not rewrite Meaning |
| Empty `availableTokens` | No Case-coherent action | Vocabulary / reading — not authz |

#### SoT rejection handling

| Code | UX | Rule |
| ---- | -- | ---- |
| `CASE_COMMAND_SOT_REJECTED` | Show SoT rejected (typed message only) | SoT owns validation; do not invent Case compensating txn |
| `CASE_COMMAND_REEXECUTE_FAILED` | Warn mutation may have landed; force Meaning refresh | No Case rollback |
| `CASE_COMMAND_PROVIDER_UNAVAILABLE` | Retry / later; no optimistic Meaning | Fail closed on execute |

#### Refresh after command

- Success **must** replace Meaning with response Encounter (new `executionId`) or force GET.
- Failure **must not** leave optimistic Meaning edits.
- Operational View classic tabs remain independent; optional deep-link back to Meaning with same `registrationId`.

### 3. UX boundary

#### UI may display

- EncounterView sections (attention, reasoning, ownership, confidence, completeness)
- `commandCapability` as **read-only discovery** (tokens + endpoint metadata)
- `executionId` / fingerprint as opaque provenance (debug/ops)
- Typed bridge failure codes (public contract only)
- Confirm/cancel chrome **only in a future Command UI PR** (not PR18-A)

#### UI must never infer

| Forbidden inference | Why |
| ------------------- | --- |
| Token available ⇒ actor may POST | Capability ≠ permission |
| Token missing ⇒ unauthorized | May be vocabulary / incomplete reading |
| Meaning reading ⇒ SoT row state | Case interprets; SoT owns rows |
| Gateway / payment brand from Meaning | No gateway DTO leakage |
| CaseOutput / FactSnapshot fields | Presentation boundary |
| Success without refresh | Ephemeral Case; always re-execute |
| Bridge endpoint in metadata ⇒ call FinanceService client-side | Host bridge only |

#### Encounter meaning → possible actions

```text
Encounter.allow  ──derive──►  commandCapability.availableTokens
                                      │
                                      │  (discovery only)
                                      ▼
                         Future UX: offer confirmable intents
                                      │
Encounter.forbid ──► never offer those tokens (even if operator asks)
decisionReady / completeness ──► may gate *chrome enablement* copy only;
                                 Host vocabulary gate still authoritative on POST
```

Mapping is **Host/UI projection of portable tokens**, not a new interpreter rule set. finance-core unchanged.

### 4. Isolation & readiness proofs (PR18-A)

Prove (static / architecture specs):

1. Existing command-bridge Host remains the sole mutation path for Case-hinted `reviewReceipt`
2. Commercial Meaning / Encounter UI modules do not import FinanceService, bridge runners, or gateway SDKs
3. finance-core package sources unchanged by PR18-A (no command imports)
4. `commandCapability` helpers expose discovery only — **no** `mayExecute` / permission grant API
5. No CaseOutput / FactSnapshot / gateway brand leakage in UX architecture contracts
6. Command Center Meaning remains button-free in this PR

### 5. PR18-A ship / non-ship

**Ships:** UX architecture (this section), web architecture contract module, readiness proofs, doc updates (operator experience + interpreter boundary).

**Does not ship:** Approve/reject buttons, confirm dialogs, web BFF mutation calls from Meaning, new commands, auto-actions, Case persistence, FinanceService / finance-core changes.

### 6. Readiness decision

| Decision | Meaning |
| -------- | ------- |
| **READY_FOR_UI_IMPLEMENTATION** | Architecture + proofs complete; a subsequent PR **may** implement Command Bridge chrome under these contracts — still requires explicit Architect approval to start buttons |
| NOT_READY | Architecture gaps remain |

**PR18-A decision: READY_FOR_UI_IMPLEMENTATION** (architecture gate). Implementing buttons is **out of scope** until explicitly approved.

---

## PR18-B — Command Bridge UI (`reviewReceipt` only)

**Scope:** First Command UI — extremely narrow. Confirm → POST existing Host bridge → typed result → **force Meaning refresh**. No optimistic Meaning patch.

### Hard locks

| Lock | Rule |
| ---- | ---- |
| Command | `reviewReceipt` only (`approve_evidence` / `reject_evidence`) |
| Forbidden | capture / refund / settlement / bulk / auto-execute |
| Discovery | `commandCapability` metadata only |
| Permission | Host session on POST — capability never grants |
| Mutation path | Web BFF → Host `POST /finance/case/commands/review-receipt` → FinanceService |
| UI must not | Import finance-core Case internals, call FinanceService, expose CaseOutput |
| Classic receipts | Operational View `PATCH /finance/receipts/:id/review` remains functional |
| Rollout | Manual fail-closed flag + **single tenant** |

### Rollout env (fail-closed)

```bash
FINANCE_CASE_COMMAND_UI_ENABLED=true
FINANCE_CASE_COMMAND_UI_TENANT=<exactly-one-tenant-uuid>
```

Chrome renders only when both are set and `session.tenantId === FINANCE_CASE_COMMAND_UI_TENANT`. Empty / multi-tenant lists are **not** supported in PR18-B (single tenant only). Default: **off**.

### Operator flow

```text
Commercial Meaning (flag on + allowlisted tenant)
        │
        ├─ GET Encounter → discovery tokens + executionId + meaningFingerprint + caseKey
        ├─ Load pending receipts (SoT list) for registrationId → pick receiptId
        ├─ Operator selects token → CONFIRM step (required)
        ├─ POST /api/finance/case/commands/review-receipt (intent body + Idempotency-Key)
        ├─ Success → show typed OK → remount/refresh Encounter (new executionId)
        └─ Failure → typed UX (no optimistic Meaning)
```

`receiptId` / `counterpartyId` are **SoT product ids** — never inferred from CaseOutput. Operator supplies via pending-receipt picker + counterparty field (optional embed/query default).

### Failure UX map

| Host code | UX class | Operator action |
| --------- | -------- | --------------- |
| `CASE_COMMAND_AUTH_DENIED` | `auth_denied` | Stop; not a Case forbid |
| `CASE_COMMAND_VOCABULARY_DENIED` | `vocabulary_denied` | Refresh Meaning; re-check tokens |
| `CASE_COMMAND_STALE` | `concurrency_conflict` | Force refresh; re-confirm |
| `CASE_COMMAND_SOT_REJECTED` | `sot_rejected` | Show SoT message; classic path still available |
| `CASE_COMMAND_PROVIDER_UNAVAILABLE` | `provider_unavailable` | Retry later |
| `CASE_COMMAND_REEXECUTE_FAILED` | `reexecute_failed` | Warn mutation may have landed; force Meaning refresh |
| `CASE_COMMAND_INTENT_INVALID` | intent invalid | Fix form; do not POST again blindly |

### Modules

| Path | Role |
| ---- | ---- |
| `finance-case-command-ui-rollout.ts` | Fail-closed enabled + single tenant |
| `finance-case-command-review-receipt.ts` | Intent body builder + response/error parse |
| `finance-case-command-review-receipt-ui.tsx` | Confirm chrome inside Commercial Meaning |
| `app/api/finance/case/commands/review-receipt/route.ts` | BFF proxy POST |

### PR18-B ship / non-ship

**Ships:** Meaning-only `reviewReceipt` Command UI behind single-tenant flag; BFF; confirm → POST → refresh; typed failures; proofs.

**Does not ship:** Other commands, bulk, auto-run, optimistic UI, finance-core / FinanceService changes, Case persistence, production default enablement.

### Verdict vocabulary

| Verdict | Meaning |
| ------- | ------- |
| **READY_FOR_INTERNAL_COMMAND_ROLLOUT** | Narrow UI + proofs green; ops may enable flag for one tenant |
| **HOLD_FOR_FIX** | Blocking defect in safety/flow |

**PR18-B decision: READY_FOR_INTERNAL_COMMAND_ROLLOUT** (proofs green; enable flag for one tenant only).

---

## PR18-C — Single-tenant internal Command UI validation

**Scope:** Controlled live validation of the PR18-B `reviewReceipt` path against **one** Denali tenant. No command expansion. Classic review path stays.

### Exact rollout (executed)

| Surface | Config |
| ------- | ------ |
| Encounter | `MODE=internal`, `INTERNAL_TENANTS=…000003` (unchanged ladder) |
| Shadow | `FINANCE_CASE_SHADOW_ENABLED=false` |
| Command UI | `ENABLED=true`, `TENANT=…000003` (single only) |

### Validation matrix

1. Happy path — capability → confirm → BFF → Host → FinanceService → SoT change → new `executionId` → Meaning refresh  
2. Operational parity — classic Receipts matches SoT; no duplicate mutation  
3. Stale — classic mutate then old intent → `CASE_COMMAND_STALE`; no second write  
4. Authz — `CASE_COMMAND_AUTH_DENIED` before SoT  
5. SoT reject — `CASE_COMMAND_SOT_REJECTED`; Meaning still refreshable  
6. Provider / re-execute — UI never claims success without fresh Encounter  
7. Isolation — other tenant / empty / multi-tenant → fail closed  
8. Regression — hub / payments / receipts / classic review; Encounter disabled → no Case; no leakage  

Live script: `scripts/pr18c-denali-command-ui-smoke.sh` → `/tmp/pr18c-command-ui-smoke.json`.

### Recommendation vocabulary

| Verdict | Meaning |
| ------- | ------- |
| **CONTINUE** | Keep single-tenant observation; fix residuals before widen |
| **HOLD** | Blocking safety/SoT defect |
| **READY_FOR_CONTROLLED_PRODUCTION** | Single-tenant Command UI may remain on for the validated tenant only — still not multi-tenant / not vocabulary expand |

**PR18-C decision: READY_FOR_CONTROLLED_PRODUCTION** (single tenant `…000003` only).

Evidence summary (see runbook §PR18-C): happy path 200 + unpaid→paid; Meaning `executionId` rotated; stale 409 `CASE_COMMAND_STALE`; classic-then-stale 409; auth 401; isolation fail-closed; hub/payments regression OK. Artifact `/tmp/pr18c-command-ui-smoke.json`. Classic review retained; no capture/refund/settlement.

---

## PR19 — Controlled production observation

**Scope:** Report-only observation of the PR18-C single-tenant `reviewReceipt` Command UI + Commercial Meaning. **Not** a command expansion. **Not** multi-tenant enablement.

### Locks

| Lock | Value |
| ---- | ----- |
| Command UI tenants | Exactly one (`…000003`) |
| Encounter | `MODE=internal`, same allowlist |
| Shadow | **OFF** |
| Classic review | Retained |
| Vocabulary | `reviewReceipt` only |
| Flag mutation | Never automatic |

### Health report (vendor-neutral)

Host composes `ControlledProductionHealthReport` from Meaning client events + Encounter samples + Command Bridge telemetry + Command UI client events + classic review observations. Recommendation kinds: `CONTINUE` · `HOLD` · `READY_FOR_EXPANSION` (`mutatesFlags: false`).

Semantic discrepancies → `HOST_MAPPING` / `SOT_POLICY` / `CASE_INTERPRETER` / `EXPECTED_DIFFERENCE` only — no interpreter law edits from frequency alone.

### PR19 decision

**CONTINUE** (single tenant `…000003`). Live Meaning observation healthy (8/8, 0% EXCEPTION); command volume in this window insufficient for `READY_FOR_EXPANSION`. Flags unchanged. Artifacts: `/tmp/pr19-production-health-report.json`, `/tmp/pr19-controlled-production-observation.json`.


---

## PR20 — Controlled command usage observation

**Scope:** LIVE `reviewReceipt` Command UI usage on tenant `…000003` only. Evidence gate — not vocabulary expansion.

### Locks

Same as PR18-C/PR19: single Command UI tenant; Encounter internal allowlist unchanged; shadow OFF; classic review retained; fail-open telemetry only.

### Classic vs Command

Compare receipt/booking/idempotency/stale/Meaning/classic representation. Discrepancies → `HOST_MAPPING` / `SOT_POLICY` / `CASE_INTERPRETER` / `CLASSIC_UI_BEHAVIOR` / `EXPECTED_DIFFERENCE`. Never silent normalize.

### PR20 decision

**CONTINUE** — see runbook §PR20 LIVE A–F; residual post-approve EXCEPTION = `SOT_POLICY`; no vocabulary expand.


---

## PR20-A — Command observation completion gate

Evidence-only completion of the ≥3 LIVE successful `reviewReceipt` floor. No vocabulary expand; no allowlist expand; no finance-core / FinanceService policy change; no Case persistence; classic review retained.

### Bridge path (re-verified on third LIVE)

Command UI → `CaseCommandIntent` → Host authz → vocabulary/coherence → stale guard → `FinanceService.reviewReceipt` → SoT → fresh Encounter.

Third LIVE approve (`…518`, receipt `febc8ab4-…`): HTTP **200**; unpaid→paid; `executionId` rotated; Meaning refresh → **EXCEPTION** (`SOT_POLICY` residual, not bridge defect).

Stale re-proof: **409** `CASE_COMMAND_STALE` after classic mutate; no second SoT write. Auth **401**. Isolation fail-closed.

### PR20-A decision

**CONTINUE** — LIVE floor **3/3** met; safety clean; residual classified. Not `READY_FOR_EXPANSION` (EXCEPTION pressure on paid+remaining class). Never auto-expand tenant allowlist. See runbook §PR20-A.
