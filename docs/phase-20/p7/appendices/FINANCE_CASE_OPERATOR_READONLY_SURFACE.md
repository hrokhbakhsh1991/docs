# Finance Case Operator Read-only Surface (PR8-A)

```yaml
doc_id: FINANCE_CASE_OPERATOR_READONLY_SURFACE
version: "2026-08-07-v1"
package: Host UX (future) · finance-core CaseEncounterView (contract)
status: ARCHITECTURE / IMPLEMENTATION PLANNING
phase: PR8-A — planning only (no UI code · no commands · no mutations · no Case persistence)
authority: >
  FINANCE_CASE_INTERPRETER_BOUNDARY · PR6-A Encounter View ·
  PR7 Operator Experience · PR6-B Command Bridge (future intents only)
related:
  - docs/phase-20/p7/appendices/FINANCE_CASE_OPERATOR_EXPERIENCE.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_COMMAND_BRIDGE.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_INTERPRETER_BOUNDARY.md
```

## Purpose

Answer **only**:

> Can an operator **understand** Case meaning safely?

Does **not** answer:

> Can an operator **change** finance state?

PR8-A plans the first **operator-facing read-only surface** on top of `CaseEncounterView`. The UI makes existing Case meaning understandable **without creating new meaning**.

**This PR is planning only** — no UI implementation, routes, OpenAPI, schema, commands, or business-rule changes.

---

## Hard locks (PR8-A)

### Inherited

| Lock | Meaning |
| ---- | ------- |
| finance-core product-agnostic | Shell has no Denali/subscription/marketplace branches for meaning |
| Interpreter = only decision authority | UI never re-interprets |
| EncounterView = UI consumption contract | No raw CaseOutput in components |
| No raw FactSnapshot in UI | Facts reach UI only via projection companions if any |
| No Case persistence / lifecycle storage | Refresh = new execution |
| No command execution / payment mutation | Actions = future intents only |
| Signal ≠ verdict | Separate visual channels |
| UI ≠ decision engine | Display ≠ decision |

### Additional

| Lock | Meaning |
| ---- | ------- |
| EncounterView (and approved companions) only | Prevent UI reinterpretation |
| UI owns presentation only | Layout, a11y, localization — no financial rules |
| Workspace differences outside core | Adapters, chooser, i18n, config |
| Refresh = new `executeFinanceCase` | No client Case state machine |
| Operator actions = future intents | No mutation bridge in PR8-A |

---

## 1. Operator UI boundary

```text
finance-core
  FactSnapshot → interpret → CaseOutput
  projectCaseEncounter → CaseEncounterView
  [optional companion] projectEncounterFactSummary → presence labels only
        │
        │ Host loads / refreshes (orchestration)
        ▼
Operator Experience Host
  · caseKey chooser
  · workspace config / localization
  · packages ReadOnlyEncounterScreenModel
        │
        │ presentation props only
        ▼
UI Components (read-only shell)
        │
        ▼
Human operator understanding
```

### Forbidden edges

```text
UI  →  FactSnapshot  →  custom interpretation     ❌
UI  →  CaseOutput fields to invent owner/money    ❌
UI  →  FinanceService / Prisma mutation           ❌
UI  →  merge Case A + Case B into one story       ❌
```

### Allowed Host packaging (conceptual)

```text
ReadOnlyEncounterScreenModel = {
  encounter: CaseEncounterView,           // required — verdict + explainability
  factSummary?: EncounterFactSummary,     // optional companion — TriFact kind labels only
  productChrome?: OpaqueProductContext,   // tour title, invoice # — labeled non-verdict
  chooser?: CaseChooserState,             // Host multi-case
  intents?: FutureActionIntent[],         // disabled / hidden in PR8-A
}
```

`EncounterFactSummary` (if introduced later) is a **finance-core or Host projection** of known/unknown/absent labels — **not** UI math and **not** a second interpreter. Until that companion exists, PR8-A Phase 1 ships **EncounterView-only** sections (Identity, Explanation, Ownership, Attention); Facts Summary is a planned section that must not be faked with client heuristics.

---

## 2. Component ownership model

| Layer | Owns | Must not own |
| ----- | ---- | ------------ |
| **finance-core** | CaseEncounterView; (future) fact-presence summary projection; vocabulary tokens | UI components, routes, i18n strings, Denali types |
| **Host (apps/api or BFF)** | Load/refresh execution; chooser candidate list; authz for *view*; screen model assembly | Presentation widgets; reinterpretation |
| **UI shell package** (future, product-agnostic) | Section layout; signal vs verdict chrome; a11y; copy-key binding | Owner inference; money calculation; workspace if/else for meaning |
| **Workspace adapter** | Fact providers; caseKey discovery; localization packs; product chrome labels | Case laws; EncounterView shape changes for one product |
| **Operator** | Understanding; future intent to act | Authoring financial truth |

### Suggested component tree (planning — not implemented)

```text
CaseEncounterReadOnlyPage
├── CaseChooserRail              (Host data; one selection)
├── EncounterAttentionBanner     (signal channel only)
├── EncounterIdentityHeader
├── EncounterExplanationPanel    (headline, confidence, completeness)
├── EncounterOwnershipPanel      (owner, lane, posture — display only)
├── EncounterFactSummaryPanel    (companion projection or deferred)
└── EncounterIntentPlaceholder   (future intents; non-operative in PR8-A)
```

Each leaf binds **props → tokens → localized strings**. No `if (receipt) owner = finance` branches.

---

## 3. EncounterView consumption rules

### Normative

1. Presentational components accept **`CaseEncounterView`** (plus optional approved companions) — never `CaseOutput`, never `FactSnapshot`.  
2. Verdict fields (`reading`, `owner`, `lane`, `primaryPosture`, `allow`, `forbid`, completeness class) are **rendered**, not transformed into new enums.  
3. Explanation copy binds to `explainability.headline`, `explainability.ownerSummary`, and `confidence.*` — UI does not author “why waiting.”  
4. `discoveryAttention` renders only in the **Attention** channel.  
5. Changing attention with identical EncounterView verdict fields must not change Ownership/Explanation verdict chrome (proof required).  
6. Refresh discards prior screen model and reloads from Host execution — no optimistic local Case status.  
7. `allow` / `forbid` may render as **non-interactive** vocabulary badges; clicks do not mutate.

### Information architecture (read-only view)

#### Identity

| Display | Source |
| ------- | ------ |
| Opaque `caseKey` | `encounter.caseKey` |
| Subject kind | `encounter.subjectKind` |
| Counterparty presentation | Host maps opaque `counterparty` handle → display label **without** changing verdict |

**Never expose as finance concepts:** `registrationId` semantics, Denali entity graphs, marketplace internals as Case identity.

#### Explanation (primary)

| Display | Source |
| ------- | ------ |
| Headline | `explainability.headline` |
| Why this reading | `explainability` + reading token localization |
| Confidence | `confidence` quartet (all four meanings visible — not color-only) |
| Completeness | `completeness` flags + `displayToken` |

#### Ownership

| Display | Source |
| ------- | ------ |
| Owner summary | `explainability.ownerSummary` / `owner` |
| Lane | `lane` |
| Posture | `primaryPosture` |

**No reassignment controls** in PR8-A.

#### Evidence / Facts Summary (planned companion)

| Display (labels only) | Must not |
| --------------------- | -------- |
| Obligation presence kind | Sum remaining / invent due |
| Payment / intent state labels | Infer owner from “pending receipt” |
| Evidence progress labels | Treat upload as finance ownership |
| Lifecycle eligibility labels | Drive lifecycle mutation |

If companion absent in early prototype: omit panel — **do not** derive from raw SoT lists in the UI.

#### Attention (separate channel)

```text
Attention:  "Receipt review requested"     ← discoveryAttention
Verdict:    "Awaiting finance inspection" ← headline / reading
```

Never combine into one urgency-as-ownership banner.

---

## 4. Workspace portability validation

Same UI shell; only adapters / chooser / localization / workspace config change.

| Probe | Product examples | Shell |
| ----- | ---------------- | ----- |
| **A Enrollment** | Collection + manual receipt | Same sections |
| **B Subscription** | Billing + online payment | Same sections; wait without offline receipt still via EncounterView |
| **C Marketplace** | Buyer payment / seller payout / dispute | Chooser mandatory; isolated meanings |

**Validation checklist (planning gates):**

- [ ] No `workspaceType === "denali"` branches inside verdict components  
- [ ] Copy keys keyed by portable tokens (`reading`, `owner`, `completenessClass`, `subjectKind`)  
- [ ] Case chooser supplied by Host per workspace  
- [ ] Product chrome clearly labeled non-verdict  

---

## 5. Multi-case handling

```text
Workspace discovery
      ↓
Case chooser (Host)
      ↓
Single CaseEncounterView (+ optional companion)
      ↓
UI shell
```

**Forbidden:** Case A + Case B → merged finance story / net position as one Case.

---

## 6. Explainability rules (operator Q&A)

| Operator asks | Answer from | Not from |
| ------------- | ----------- | -------- |
| Why is this waiting? | EncounterView explanation + confidence `ifIWait` | UI-written copy, hidden frontend `if`s |
| Who owns follow-up? | `owner` / `ownerSummary` | “Receipt exists ⇒ finance” |
| What’s missing? | `completeness` | Guessing from empty SoT panels |
| Why did I land here? | Attention channel | Overwriting verdict headline |

---

## 7. Testing strategy

### Contract

| Proof | Method (when implementing) |
| ----- | -------------------------- |
| UI receives EncounterView only | Type/props lint; forbid imports of `CaseOutput` / `FactSnapshot` in UI shell package |
| Raw CaseOutput unavailable to presentational tree | Boundary test / eslint import restriction |
| Raw facts unavailable | Same — no `assembleCaseFactSnapshot` in UI |

### Determinism

| Proof | Method |
| ----- | ------ |
| Same EncounterView → same rendering | Snapshot / DOM contract tests with fixed view fixture |

### Safety

| Proof | Method |
| ----- | ------ |
| Signal change does not change verdict display | Two fixtures: identical EncounterView verdict fields, different `discoveryAttention` → Ownership/Explanation DOM equal |

### Portability

| Proof | Method |
| ----- | ------ |
| Manual payment / online payment / future products | Same shell + three Host fixtures (A/B/C subjectKinds); assert section structure identical |

### Accessibility

| Proof | Method |
| ----- | ------ |
| Confidence meaning visible | Text for all four confidence strings (or aria labels), not color alone |
| Completeness understandable | Text / role for inspect/escalate/wait tokens |
| No color-only meaning | Contrast + non-color cue audit |
| Keyboard navigation | Chooser + sections focus order |

### Explicit non-tests (PR8-A)

- Mutation / command bridge e2e  
- Case persistence  
- Interpreter rule correctness (covered in finance-core)  

---

## 8. Rollout plan

### Phase 1 — Internal operator prototype

- Host façade: caseKey → EncounterView (existing execute path)  
- Read-only shell behind internal flag / staff-only route  
- **No** production workflow change  
- EncounterView-only IA; Facts Summary deferred unless companion projection lands  

### Phase 2 — Read-only pilot

- Small operator cohort  
- Observe: misunderstanding, missing explanations, incomplete cases, chooser confusion  
- Telemetry: refresh rate, time-on-explanation, attention vs verdict confusion reports (qualitative OK)  
- Still **no** commands  

### Phase 3 — UX refinement

- Copy / layout / a11y fixes from pilot  
- Optional Fact Summary companion if operators lack “what’s known”  
- Still **no** commands; intents remain placeholders until PR6-B Host bridge  

### Exit criteria (understandability)

| Criterion | Met when |
| --------- | -------- |
| Operator can state reading + owner without inventing rules | Pilot interview / task test |
| Signal not reported as ownership | Confusion reports = 0 on that failure mode |
| Refresh recovers after SoT change | Manual script: mutate SoT outside UI → refresh → new view |

---

## 9. Deliverables checklist

| # | Deliverable | Location |
| - | ----------- | -------- |
| 1 | Operator UI boundary | §1 |
| 2 | Component ownership model | §2 |
| 3 | EncounterView consumption rules + IA | §3 |
| 4 | Workspace portability validation | §4 |
| 5 | Testing strategy | §7 |
| 6 | Rollout plan | §8 |

---

## Implementation readiness verdict

| Item | Status |
| ---- | ------ |
| PR7 experience architecture | Ready |
| CaseEncounterView contract | Ready (PR6-A) |
| PR8-A surface plan | **Ready (this doc)** |
| UI shell implementation | **Not started** — authorized only after explicit implementation PR |
| Fact Summary companion projection | **Planned** — optional before Phase 2 if pilot needs it |
| Command / mutation bridge | **Forbidden** in PR8-A |
| Case persistence | **Forbidden** |

**Verdict:** Planning is sufficient to start a **read-only prototype implementation PR** later. This document alone does **not** ship UI. Operator actions remain future intents; understandability is the only success measure.

---

## PR8-B — Read-only UI implementation

```yaml
phase: PR8-B
package: "@app-tour/finance-case-encounter-ui"
status: IMPLEMENTED (read-only shell)
```

### What shipped

| Artifact | Role |
| -------- | ---- |
| `CaseEncounterViewContract` | Structural EncounterView presentation contract (compatible with finance-core `CaseEncounterView`) |
| `CaseEncounterReadOnlyScreen` | Identity / Explanation / Ownership / Confidence / Completeness / Attention |
| `CaseEncounterReadOnlyHost` | Load + refresh + loading/error boundaries; injects `loadEncounter` only |
| Fixtures A/B/C | Enrollment / subscription / marketplace subjectKinds — same shell |
| Safety tests | Import firewall, signal≠verdict, determinism, a11y text |

### Still out of scope

Approve/reject/payment/receipt actions, Command Bridge UI, Case persistence, Fact Summary companion.

### PR12-A — Denali production wiring

See [`FINANCE_CASE_OPERATOR_ENCOUNTER_WIRING.md`](./FINANCE_CASE_OPERATOR_ENCOUNTER_WIRING.md).

Live Host adapter + Denali `/finance/case/[registrationId]` read-only screen. Mutation chrome still deferred.

---

## Final constraint (canonical)

```text
PR8-A: Can an operator understand Case meaning safely?
        → Yes path: EncounterView → presentation shell → human.

PR8-A: Can an operator change finance state?
        → Out of scope. Commands remain future Host + SoT work.
```

---

## Non-goals (PR8-A)

- Implementing React/Next routes or components in this planning PR  
- Command Bridge wiring / mutation buttons  
- Case repository or Case status  
- UI consumption of FactSnapshot or CaseOutput  
- New interpreter / business rules  
- Production workflow replacement  
