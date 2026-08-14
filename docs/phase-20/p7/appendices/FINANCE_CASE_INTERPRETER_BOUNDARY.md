# Finance Case Interpreter Boundary (PR1)

```yaml
doc_id: FINANCE_CASE_INTERPRETER_BOUNDARY
version: "2026-08-08-v52"
package: "@app-tour/finance-core"
module: src/case/
status: BOUNDARY
phase: Phase 0–PR20-B (SoT paid-vs-remaining policy gate)
authority: >
  Finance Domain Model v1 · Interpreter Rules v1 · Port Contracts v1 ·
  Core Boundary & Port Architecture v1 · Implementation Plan v1 ·
  PR4 Denali Read Adapter Architecture · PR4.5-B/C · PR5-A Comparison ·
  PR5-B Production Calibration · PR6-A Case Encounter View ·
  PR6-B Command Bridge Architecture · PR7 Operator Experience Architecture ·
  PR8-A Operator Read-only Surface Plan · PR8-B Read-only UI Implementation ·
  PR9-A Command Bridge Foundation · PR9-B Host reviewReceipt Bridge Pilot ·
  PR10-A Payment Capability Adapter Architecture · PR10-B Payment Capability Host Foundation ·
  PR10-C Real Online Gateway Payment Adapter ·
  PR11-A Finance Capability Reconciliation Architecture ·
  PR11-B Host Reconciliation Classifier & Cue Emission ·
  PR11-C Denali Reconciliation + Payment Capability Composition ·
  PR12-A Denali Operator Encounter Production Wiring ·
  PR12-B Denali Production Hardening & Contract Stabilization ·
  PR12-C Denali Encounter Production Readiness ·
  PR13-A Denali Encounter Controlled Production Rollout + Operator Feedback ·
  PR13-B Denali Encounter Pilot Activation + Operational Validation ·
  PR13-C Workspace Portability Proof ·
  PR14-A Production Command Bridge Architecture ·
  PR14-B Host Command Bridge Production Wiring ·
  PR15-A Validation Hardening ·
  PR15-B Denali Live Smoke Validation ·
  PR15-C Denali Encounter Pilot Activation ·
  PR15-D Encounter Fact Coverage Calibration ·
  PR15-E Denali Obligation Adapter Coverage Fix ·
  PR15-F Denali Encounter Pilot Validation ·
  PR15-G Paid-with-Remaining Calibration ·
  PR15-H Optional Ledger Degradation ·
  PR16-A Controlled Internal Rollout ·
  PR16-B Finance Case Shadow Comparison ·
  PR16-C Internal Shadow Validation & Decision Gate ·
  PR16-D Finance Case Semantic Calibration ·
  PR16-E ADR Finance Case Canonical Meaning ·
  PR17-A Finance Command Center Commercial Meaning Integration ·
  PR17-B Commercial Meaning Embed Hardening & Observability ·
  PR17-C Commercial Meaning Internal Operator Read Rollout & Feedback Calibration ·
  PR18-A Command Bridge UX Architecture ·
  PR18-B Command Bridge UI reviewReceipt ·
  PR18-C Single-Tenant Internal Command UI Validation
  PR19 Controlled Production Observation
  PR20 Controlled Command Usage Observation
  PR20-A Command Observation Completion Gate
  PR20-B SoT Paid-vs-Remaining Policy Gate
```

## Purpose

Establish the **finance-core Case interpretation kernel** as a parallel, pure module that transforms a fact snapshot into an ephemeral `CaseOutput`.

This document is the architecture gate for `packages/finance-core/src/case/`.

---

## Hard locks

| Lock | Meaning |
| ---- | ------- |
| **CaseOutput is ephemeral** | Produced at interpret time; never a database row or workflow SoT |
| **No Case status persistence** | No Case table, no `case_status` enum as authority |
| **Facts only** | Interpreter input is a Fact Snapshot; adapters/providers supply facts later |
| **External SoTs remain owners** | Payment, evidence/receipt, ledger, obligation, product lifecycle stay outside Case |
| **Signals are discovery only** | Attention metadata must not define verdict |
| **A/B/C portability** | Enrollment, subscription, and marketplace (buyer/payout/dispute) use the same laws |
| **`src/case` boundary** | Kernel lives under `packages/finance-core/src/case/`; no Denali/workspace/app imports |

---

## What finance-core interprets

```text
Fact Snapshot
  → completeness
  → conflict detection
  → eligibility / money / evidence·intent / settlement meaning
  → ownership → lane → posture → confidence
  → CaseOutput (ephemeral)
```

Finance-core **does not**:

- Persist Case or CaseOutput
- Own lifecycle transitions
- Treat payment/receipt/ledger lists as the task model
- Import `@app-tour/workspace-*`, `packages/workspaces/*`, or `apps/*`
- Replace `FinanceService` payment/receipt/ledger workflows

---

## Module home

```text
packages/finance-core/src/case/
  facts/       unknown ≠ absent ≠ zero · portable fact groups
  snapshot/    FactSnapshot + EncounterMetadata (signals segregated)
  output/      CaseOutput + vocabularies
  rules/       completeness, conflict, collision, ownership, posture, confidence
  interpret/   interpretFinanceCase(snapshot)
  ports/       Case *read* fact providers (not SoT command ports)
  assemble/    Host-owned FactSnapshot orchestration (PR3; no interpretation)
  execute/     Execution Layer (PR3.5; assemble → interpret + diagnostics only)
  shadow/      Internal shadow observation (PR4.5-A; fail-isolated; no host wiring)
  encounter/   Read-only CaseOutput → Encounter View projection (PR6-A)
```

**Denali read adapters (PR4-A) — outside finance-core:**

```text
packages/workspaces/denali/src/finance/case-read/
  → pure Denali SoT DTO → portable fact mappers (no interpreter / CaseOutput)

apps/api/src/workspace-finance/case-read/
  → host SoT loaders + Case fact provider façades
```

### Approved Case surface (PR4.5-B) — Option A

**Decision:** experimental package subpath `@app-tour/finance-core/case` (`exports["./case"]`).

| Allowed on `./case` | Forbidden on `./case` and root |
| ------------------- | ------------------------------ |
| `executeFinanceCase`, `runShadowFinanceCase` | `rules/*` (ownership, posture, confidence, …) |
| Case fact **port contracts** + unknown helpers | Denali / workspace / Prisma types |
| Portable fact tokens + fact groups + `FactSnapshot` | Case repository / mutable Case state |
| Ephemeral `CaseOutput` **types** (+ `interpretFinanceCase` pure entry) | Adapter implementations |
| Assembler orchestration types/functions | Root-barrel Case pollution |

**Root package (`.`)** remains FinanceService-era API only — no Case runtime exports.

**Host wiring ownership (`apps/api/src/workspace-finance/case/`):**

| Host owns | Host does not own |
| --------- | ----------------- |
| Auth / tenant / RLS before SoT reads | Verdict / owner / posture |
| CaseKey + scope selection | Fact repair / inventing zeros |
| Provider factory (Denali → Case ports) | Lifecycle writes / payment commands |
| Feature flag + diagnostics sink | Persisting CaseOutput |

```text
apps/api workspace-finance
  → createDenaliCaseFactProviders(source)
  → executeFinanceCase | invokeFinanceCaseShadow (flagged)
  → ephemeral CaseOutput + diagnostics (sink only)
```

### Shadow invocation lifecycle (PR4.5-B → PR4.5-C)

```text
Existing FinanceService / booking workflow (primary)
        |
        +---- if FINANCE_CASE_SHADOW_ENABLED (Denali host wrap)
        |       → scheduleDenaliFinanceCaseShadow (flag-gated; fail-open)
        |       → HostDenaliCaseReadSource (tenant RLS repos)
        |       → createDenaliCaseFactProviders → runShadowFinanceCase
        |       → FinanceCaseObservationSink (diagnostics only)
        |       → never mutates primary return
        |
        +---- if disabled → zero Case execution · zero extra SoT reads
```

### Live SoT ownership (PR4.5-C)

| Concern | Owner |
| ------- | ----- |
| Booking / payment / receipt / ledger reads | Host repos (`apps/api`) under tenant RLS |
| Commercial obligation / collection mode | Host `FinanceObligationPort` (workspace bind) |
| DTO → portable facts | Denali `finance/case-read` mappers |
| Provider DI + shadow wrap | `apps/api/src/workspace-finance/case/` |
| Verdict / owner / posture | finance-core interpreter only |

**Allowed observational triggers (host wrap; post-success only):**

- post receipt submit
- post receipt review
- post manual payment create
- selected finance reads (e.g. registration invoice) when explicitly scheduled
- sampled background (host may pass `triggerKind: sampled`)

**Forbidden:** replacing queues, changing HTTP status/body, blocking writes, Case persistence.

### Telemetry ownership (PR4.5-C)

`FinanceCaseObservationSink` may record: executionId, opaque caseKey, provider latency/degraded groups, interpreter duration, optional mismatch classification.

Must **not** record: Case status history, workflow state, owner timeline, mutable Case entities.

### Rollout safety

| Mode | Guarantee |
| ---- | --------- |
| Flag OFF | No `execute`/`shadow` call; no Case SoT fan-out |
| Flag ON | Primary `FinanceService` result identical; Case/sink/timeout failures ignored |

Shadow failures, timeouts, and sink errors must not throw into or alter the primary workflow result.

### Shadow comparison (PR5-A) — observational only

```text
Existing workflow SoT
  → OperationalObservation (host; what system does today)
Shadow CaseOutput
  → InterpreterClassification (read-only projection)
       ↓
Host Comparison Engine
       ↓
FinanceCaseComparisonObservation → metrics/log sink
```

| Concern | Owner |
| ------- | ----- |
| CaseOutput | finance-core interpreter |
| Operational classification | host adapter (queues/payment/eligibility paths) |
| Comparison taxonomy | host observation layer |
| Metrics / logs | host sink |
| Business decisions | existing FinanceService / ops (unchanged) |

**finance-core must not know** current queues, UI labels, or operational workflows.

**Mismatch taxonomy**

| Category | Meaning |
| -------- | ------- |
| `aligned` | Operational path and Case reading/owner agree |
| `owner_disagreement` | e.g. finance follow-up vs counterparty wait |
| `reading_disagreement` | Different interpretation of the same commercial subject |
| `exception_disagreement` | Leftover/closed cues disagree with Case EXCEPTION / healthy |
| `eligibility_disagreement` | Workflow collects / acts where Case says not eligible |
| `uncomparable` | Incomplete snapshot, degraded providers, or failed shadow — **not** a false mismatch |

**Observation event rules:** may include opaque caseKey, executionId, trigger, interpreter classification, operational classification, comparison category, degradation, latency.  
Must **not** include Case status, owner history, workflow transitions, next actions, or persisted Case entities.

**Sampling strategy (host):**

- `FINANCE_CASE_SHADOW_ENABLED` — global gate (OFF → zero shadow + zero comparison); **default false**
- `FINANCE_CASE_SHADOW_TENANTS` — required allowlist when enabled; **empty / unset = fail closed** (PR16-B; nobody runs)
- When `FINANCE_CASE_ENCOUNTER_MODE=internal`, tenant must also be on `FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS` (or tenants fallback)
- `FINANCE_CASE_SHADOW_SAMPLE_RATE` — `0..1` (default `1` when unset); excluded samples skip execution

See [`FINANCE_CASE_SHADOW_COMPARISON.md`](./FINANCE_CASE_SHADOW_COMPARISON.md) for PR16-B/C taxonomy, validation report, and decision gate. Live decision: [`FINANCE_CASE_SHADOW_DECISION_REPORT.md`](./FINANCE_CASE_SHADOW_DECISION_REPORT.md).

Comparison is fail-open and must never auto-fix workflows, mutate SoTs, or create Case records.

### Production calibration (PR5-B) — measurement only

```text
Shadow + Comparison observation
  → FactCoverageReport (known / unknown / absent / degraded per provider)
  → MismatchCalibrationClass (hypothesis only; never auto-fix)
  → ProductionObservationSink (counters + latency)
  → QualityGateReport (thresholds; reporting only — never blocks workflow)
```

**Calibration classes (hypotheses, not remediation):**

| Class | Meaning |
| ----- | ------- |
| `adapter_translation_issue` | SoT likely mapped incorrectly into facts |
| `missing_fact_coverage` | Required facts unknown / incomplete snapshot |
| `operational_heuristic_drift` | Ops queue heuristics diverge from Case laws |
| `real_ambiguity` | Legitimate disagreement / edge case needing human review |
| `none` | Aligned or uncomparable without mismatch |

**Fact coverage:** required providers obligation / payment / evidence / lifecycle; optional ledger / signal. Counts are observational — unknown stays unknown.

**Quality gates:** report rates (exception disagreement, unknown required facts, provider failure, comparison coverage). **Never** block HTTP or mutate FinanceService.

**Cost controls (additive):**

- `FINANCE_CASE_SHADOW_TRIGGERS` — comma allowlist of triggers (default all)
- `FINANCE_CASE_SHADOW_SKIP_COMPARISON_READS=1` — shadow Case only; skip second ops SoT fan-out
- Per-trigger sample still uses global sample rate + tenant allowlist

**Assembler placement (PR3):** Orchestration remains in `src/case/assemble/` and is reachable via `./case`. It must never import `rules/` or emit Case status rows.

**Execution placement (PR3.5):** `src/case/execute/` — providers → assembler → `interpretFinanceCase` → CaseOutput + diagnostics. No fact repair.

Existing `FinanceService` and existing `src/ports/*` workflow ports remain untouched and **must not** be reused as Case fact providers.
### Case read ports (PR2)

| Port | Returns | Must not |
| ---- | ------- | -------- |
| Obligation | Money facts | CaseOutput / owner / posture |
| Payment | Intent + settlement facts | Create repair payments; verdicts |
| Evidence | Evidence facts | Approve/reject as interpretation |
| Lifecycle | Eligibility (+ leftover cue) | Lifecycle transitions; full FSM |
| Ledger | Audit cues only | Daily decision authority |
| Signal | Encounter attention only | Enter verdict inputs |

Providers return facts only. `unknown` must stay `unknown` — no default zero-fill. Signal stays on `EncounterMetadata`, never inside `CaseFacts`.

### Snapshot assembler (PR3)

```text
caseKey + encounter mode
  → invoke Case fact providers (obligation, payment, evidence, lifecycle;
     optional ledger, optional signal)
  → collect CaseFactProviderResult values (degraded → unknown facts)
  → assembleFactSnapshot → FactSnapshot
  → caller may optionally interpretFinanceCase(snapshot)
```

Assembler **coordinates only**. It must not choose owner, lane, reading, posture, or resolve conflicts.

### Execution Layer (PR3.5)

```text
executeFinanceCase(providers, request)
  → assembleCaseFactSnapshot
  → interpretFinanceCase(snapshot)
  → { caseOutput, diagnostics, snapshot }
```

Diagnostics are a sibling of CaseOutput and must never mutate interpretation results.

### Shadow foundation (PR4.5-A)

```text
runShadowFinanceCase(providers, request)
  → executeFinanceCase (isolated)
  → ShadowExecutionResult (ok | failed)
```

Shadow never persists, never classifies workflow correctness, never throws into the caller for execution/interpreter/sink failures.

### Case Encounter View (PR6-A) — read-only consumption

```text
CaseOutput (ephemeral; interpreter remains source of meaning)
  → projectCaseEncounter(caseOutput, optional discoveryAttention)
  → CaseEncounterView
      · explainability summary (headline, owner summary, posture/lane)
      · confidence presentation (whyVisible / whyMineOrNot / ifIWait / avoid)
      · completeness indicators (class + display flags)
```

**Owns:** presentation-oriented projection only.  
**Must not own:** interpretation, ownership/posture/confidence *decisions*, business rules, commands, persistence.

Optional `discoveryAttention` (from `EncounterMetadata`) may appear on the view for “why opened” display. Changing attention with identical `CaseOutput` must not change reading / owner / lane / posture / allow / forbid / completeness class.

Encounter sources under `src/case/encounter/` must not import `rules/`, Denali, Prisma, or workflow command ports.

### Command Bridge (PR6-B) — architecture only

See [`FINANCE_CASE_COMMAND_BRIDGE.md`](./FINANCE_CASE_COMMAND_BRIDGE.md).

Design gate only: maps `CaseOutput.allow` / `forbid` vocabulary → Host → existing SoT command services → mandatory re-snapshot + re-execution. **No** Case persistence, command ports in finance-core, workflow engine, or UI in this phase.

### Command Bridge Foundation (PR9-A) — planning only

See [`FINANCE_CASE_COMMAND_BRIDGE_FOUNDATION.md`](./FINANCE_CASE_COMMAND_BRIDGE_FOUNDATION.md).

First-wave Host mapper plan (receipt review completion, existing payment/receipt submit), dual-gate authz, re-execution, failure model, safety-proof matrix. **No** bridge code or UI mutation in this phase.

### Host Command Bridge Pilot (PR9-B) — `reviewReceipt` only

See [`FINANCE_CASE_COMMAND_BRIDGE_FOUNDATION.md`](./FINANCE_CASE_COMMAND_BRIDGE_FOUNDATION.md) §PR9-B and `apps/api/src/workspace-finance/case/command-bridge/`.

Host-owned dual-gate → existing `FinanceService.reviewReceipt` → mandatory fresh EncounterView. **No** UI buttons, Case persistence, or other command categories.

### Production Command Bridge Architecture (PR14-A)

See [`FINANCE_CASE_COMMAND_BRIDGE.md`](./FINANCE_CASE_COMMAND_BRIDGE.md) §PR14-A.

Formalizes production control flow: `CaseCommandIntent` → Host authz → vocabulary gate → stale protection → existing SoT → fresh Encounter. Intent ≠ permission. Failure taxonomy: `auth_denied` · `vocabulary_denied` · `sot_rejected` · `concurrency_conflict` · `provider_unavailable`. First command remains `reviewReceipt` only. **No** UI buttons, mutation HTTP productization, auto actions, or finance-core command imports.

### Host Command Bridge Production Wiring (PR14-B)

See [`FINANCE_CASE_COMMAND_BRIDGE.md`](./FINANCE_CASE_COMMAND_BRIDGE.md) §PR14-B.

Ships `POST /finance/case/commands/review-receipt` (finance-http) → Host bridge → `FinanceService.reviewReceipt` → fresh Encounter presentation. Fail-open command telemetry. UI capability metadata only (no buttons). finance-core unchanged; Case / EncounterView remain read-only.

### Validation Hardening (PR15-A)

See [`FINANCE_CASE_VALIDATION_RUNBOOK.md`](./FINANCE_CASE_VALIDATION_RUNBOOK.md).

Encounter HTTP OK allowlist updated for additive `commandCapability` + optional `meaningFingerprint` while forbidding CaseOutput / FactSnapshot / gateway ids. Staged validation + API boot investigation notes. No product integration (no UI buttons, no command BFF).

### Denali Live Smoke Validation (PR15-B)

See [`FINANCE_CASE_VALIDATION_RUNBOOK.md`](./FINANCE_CASE_VALIDATION_RUNBOOK.md) §PR15-B.

Executed Stage 1 live against Denali tenant `…000003` with Case flags disabled: finance hub, manual payment, receipt upload/submit, classic approve/reject + booking payment sync all green; Encounter remains `CASE_ENCOUNTER_DISABLED`. Stage 2 pilot **not** enabled. Helper: `scripts/pr15b-denali-finance-stage1-smoke.sh`.

### Denali Encounter Pilot Activation (PR15-C)

See [`FINANCE_CASE_VALIDATION_RUNBOOK.md`](./FINANCE_CASE_VALIDATION_RUNBOOK.md) §PR15-C.

Single-tenant pilot (`MODE=pilot`, allowlist `…000003` only). Observation / read-only Encounter GET. No shadow, no command UI, no FinanceService mutation changes. Isolation: non-pilot → zero Case execution.

### Encounter Fact Coverage Calibration (PR15-D)

See [`FINANCE_CASE_ENCOUNTER_FACT_COVERAGE_CALIBRATION.md`](./FINANCE_CASE_ENCOUNTER_FACT_COVERAGE_CALIBRATION.md).

Live incomplete rate 100% explained by Denali obligation canonical envelope mismatch (`data.pricing.*` vs root `pricing.*`). Report-only diagnostics added under `apps/api/.../case/observation/`. finance-core interpreter unchanged. Recommendation: **FIX adapter coverage** before expand.

### Denali Obligation Adapter Coverage Fix (PR15-E)

See [`FINANCE_CASE_ENCOUNTER_FACT_COVERAGE_CALIBRATION.md`](./FINANCE_CASE_ENCOUNTER_FACT_COVERAGE_CALIBRATION.md) §PR15-E.

Explicit `unwrapDenaliTourCanonicalDocument` boundary in `@app-tour/workspace-denali`; obligation / payment-collection resolvers read `pricing.*` on the unwrapped document only. finance-core / interpreter / CaseOutput / EncounterView / completeness semantics unchanged. Missing price remains unknown (never zero). Pilot: **CONTINUE** (no allowlist expand / shadow / command UI).

### Denali Encounter Pilot Validation (PR15-F)

See [`FINANCE_CASE_ENCOUNTER_PILOT_VALIDATION.md`](./FINANCE_CASE_ENCOUNTER_PILOT_VALIDATION.md).

Post-PR15-E live matrix: diverse readings, 0% obligation_unread, refresh-stable Encounter HTTP. Residual `INCOMPLETE_INSPECT` is Host settlement/remaining coherence (`no_rule_matched`), not interpreter defect. Recommendation: **CONTINUE** (not READY_FOR_INTERNAL yet).

### Paid-with-Remaining Calibration (PR15-G)

See [`FINANCE_CASE_PAID_WITH_REMAINING_CALIBRATION.md`](./FINANCE_CASE_PAID_WITH_REMAINING_CALIBRATION.md).

Ownership: remaining = invoice compile; settlement = booking payment projection; partialScope = explicit SoT only (Denali none → false, never inferred). Host emits `meaningConflictProven` when booking `paid` contradicts positive invoice remaining → existing `EXCEPTION` reading. finance-core unchanged.

### Optional Ledger Degradation (PR15-H)

See [`FINANCE_CASE_LEDGER_DEGRADATION.md`](./FINANCE_CASE_LEDGER_DEGRADATION.md).

Ledger/signal are observation-only; not required for verdict or completeness. **ACCEPT degradation** + `provider_degradation` telemetry; deferred Host concurrency/ref-match fixes. Pilot **CONTINUE**.

### Controlled Internal Rollout (PR16-A)

See [`FINANCE_CASE_INTERNAL_ROLLOUT.md`](./FINANCE_CASE_INTERNAL_ROLLOUT.md).

Internal mode allowlist fail-closed + emergency disable; internal health report (verdicts/completeness/exceptions/degradation/authz); multi-tenant isolation. Recommendation: **READY_FOR_INTERNAL** (manual activation; shadow still false; no command UI; finance-core unchanged).

### Shadow Comparison (PR16-B)

See [`FINANCE_CASE_SHADOW_COMPARISON.md`](./FINANCE_CASE_SHADOW_COMPARISON.md).

Observational shadow only: FinanceService primary unchanged; `executeFinanceCase` compare fail-open; fail-closed `SHADOW_TENANTS`; taxonomy + report. Default shadow **OFF**.

### Internal Shadow Validation & Decision Gate (PR16-C)

See [`FINANCE_CASE_SHADOW_DECISION_REPORT.md`](./FINANCE_CASE_SHADOW_DECISION_REPORT.md).

Live internal allowlist shadow validation + parity metrics + READY/HOLD gate. Current decision: **HOLD_FOR_CALIBRATION** (verdict parity 66.7% on matrix; ownership clean; mismatches understood). Optional ledger degrade no longer forces uncomparable. Deferred: UI actions, classic panel replacement, command buttons, public rollout, auto remediation.

### Semantic Calibration (PR16-D)

See [`FINANCE_CASE_SEMANTIC_CALIBRATION.md`](./FINANCE_CASE_SEMANTIC_CALIBRATION.md).

Evidence on residual mismatches: `…0529` → `HOST_MAPPING` / **CHANGE_HOST_MAPPING** (false SIGNAL when Case∩ops agree on finance review); `…0523` → `SOT_POLICY` / **KEEP_CASE** (Case EXCEPTION correct; booking `paid` with remaining). No interpreter / FinanceService / UI / rollout changes in PR16-D. Next rollout: still **HOLD_FOR_CALIBRATION**.

### ADR — Canonical Meaning (PR16-E)

See [`ADR_FINANCE_CASE_CANONICAL_MEANING.md`](./ADR_FINANCE_CASE_CANONICAL_MEANING.md).

**Decision A (ACCEPTED):** Finance Case is the canonical commercial interpreter; FinanceService remains mutation authority; legacy Finance may evolve toward Case. Residuals are Host-compare architecture defect (`…0529`) and SoT policy / legacy panel behavior (`…0523`) — not grounds to make Case mirror FinanceService (Decision B rejected). **PR17** may begin operator read integration under A. No code in PR16-E.

### Command Center Commercial Meaning (PR17-A)

See [`FINANCE_CASE_OPERATOR_EXPERIENCE.md`](./FINANCE_CASE_OPERATOR_EXPERIENCE.md).

Finance Command Center gains **Operational View** vs **Commercial Meaning** toggle. Meaning embeds read-only Encounter (attention / reasoning / ownership / confidence / completeness / command capability metadata). Classic panels unchanged; refresh = new Host execution; no command buttons; no finance-core in UI; Decision A read integration.

### Commercial Meaning Hardening (PR17-B)

See [`FINANCE_CASE_OPERATOR_EXPERIENCE.md`](./FINANCE_CASE_OPERATOR_EXPERIENCE.md) §PR17-B.

Stable embed contract (`executionId` + surface states), hub→Meaning navigation, fail-open telemetry (opened/viewed/unavailable/timeout/degraded/incomplete), timeout→unavailable. Ready for **A)** internal operator read rollout (manual). **Not** ready for command UI (**B**) or production default enablement (**C**).

### Commercial Meaning Internal Rollout & Feedback (PR17-C)

See [`FINANCE_CASE_OPERATOR_EXPERIENCE.md`](./FINANCE_CASE_OPERATOR_EXPERIENCE.md) §PR17-C and [`FINANCE_CASE_VALIDATION_RUNBOOK.md`](./FINANCE_CASE_VALIDATION_RUNBOOK.md) §PR17-C.

Internal Meaning read reuses Encounter `MODE=internal` + fail-closed `INTERNAL_TENANTS` + emergency disable. Vendor-neutral Meaning health report + report-only feedback calibration (confusion / incomplete / EXCEPTION / classic-vs-Meaning disagreement). Telemetry fail-open; **never** auto-flips flags or interpreter rules. Shadow + command UI remain disabled. finance-core unchanged; FinanceService mutation path unchanged.

### Command Bridge UX Architecture (PR18-A)

See [`FINANCE_CASE_COMMAND_BRIDGE.md`](./FINANCE_CASE_COMMAND_BRIDGE.md) §PR18-A and [`FINANCE_CASE_OPERATOR_EXPERIENCE.md`](./FINANCE_CASE_OPERATOR_EXPERIENCE.md) §PR18-A.

Defines Commercial Meaning command **surface contract** (discovery vs permission vs intent vs execution), operator action lifecycle (confirm / stale / authz / SoT reject / refresh), and UX boundaries (what UI may display vs must never infer). **No buttons**, no FinanceService / finance-core changes, no Case persistence. Architecture gate: **READY_FOR_UI_IMPLEMENTATION** — implementing chrome still requires explicit Architect approval.

### Command Bridge UI — reviewReceipt (PR18-B)

See [`FINANCE_CASE_COMMAND_BRIDGE.md`](./FINANCE_CASE_COMMAND_BRIDGE.md) §PR18-B and [`FINANCE_CASE_OPERATOR_EXPERIENCE.md`](./FINANCE_CASE_OPERATOR_EXPERIENCE.md) §PR18-B.

First Command UI: `reviewReceipt` only inside Commercial Meaning, behind `FINANCE_CASE_COMMAND_UI_ENABLED` + single `FINANCE_CASE_COMMAND_UI_TENANT`. Confirm → BFF → Host bridge → FinanceService; typed failures; force Meaning refresh; no optimistic Case state; classic receipts tab unchanged. finance-core / FinanceService unchanged.

### Single-Tenant Command UI Validation (PR18-C)

See [`FINANCE_CASE_VALIDATION_RUNBOOK.md`](./FINANCE_CASE_VALIDATION_RUNBOOK.md) §PR18-C and [`FINANCE_CASE_COMMAND_BRIDGE.md`](./FINANCE_CASE_COMMAND_BRIDGE.md) §PR18-C.

Live + automated validation of the PR18-B path for tenant `…000003` only. Encounter internal allowlist unchanged; shadow off; no vocabulary expansion; classic review retained. Evidence: happy path, parity, stale, authz, SoT reject (unit), isolation, regression.

**PR18-C decision: READY_FOR_CONTROLLED_PRODUCTION** — Command UI may stay on for `…000003` only; do not widen tenants or command vocabulary.

### Controlled Production Observation (PR19)

See [`FINANCE_CASE_VALIDATION_RUNBOOK.md`](./FINANCE_CASE_VALIDATION_RUNBOOK.md) §PR19 and [`FINANCE_CASE_COMMAND_BRIDGE.md`](./FINANCE_CASE_COMMAND_BRIDGE.md) §PR19.

Report-only observation of Meaning + `reviewReceipt` under the PR18-C single-tenant rollout. Discrepancies classify as `HOST_MAPPING` / `SOT_POLICY` / `CASE_INTERPRETER` / `EXPECTED_DIFFERENCE` — never auto-edit interpreter laws from production frequency. Recommendation: `CONTINUE` / `HOLD` / `READY_FOR_EXPANSION` (advisory; never auto-flip flags).

**PR19 decision: CONTINUE** — keep `…000003` controlled production; not READY_FOR_EXPANSION (short command-volume window).

### Controlled Command Usage Observation (PR20)

See [`FINANCE_CASE_VALIDATION_RUNBOOK.md`](./FINANCE_CASE_VALIDATION_RUNBOOK.md) §PR20.

LIVE Command UI `reviewReceipt` usage matrix (approve/reject/stale/auth/isolation) on tenant `…000003`. Case remains read/interpret only. Discrepancy classes include `CLASSIC_UI_BEHAVIOR`. **PR20 decision: CONTINUE**. Post-approve EXCEPTION residual = `SOT_POLICY` (no interpreter edit).

### Command Observation Completion Gate (PR20-A)

See [`FINANCE_CASE_VALIDATION_RUNBOOK.md`](./FINANCE_CASE_VALIDATION_RUNBOOK.md) §PR20-A.

Evidence-only: LIVE floor **3** (approve×2 + reject×1); paid+remaining EXCEPTION re-probed on `…518` and `…522` → **`SOT_POLICY`** (repeatable SoT write-policy / commercial conflict — **not** `CASE_INTERPRETER`, **not** adapter). Interpreter laws **unchanged**. Stale/auth/isolation preserved. **Decision: CONTINUE** (not READY_FOR_EXPANSION — exception_pressure). Never auto-expand allowlist.

### Payment Capability Adapters (PR10-A) — architecture only

See [`FINANCE_CASE_PAYMENT_CAPABILITY.md`](./FINANCE_CASE_PAYMENT_CAPABILITY.md).

Workspace selects manual / online / hybrid payment providers; adapters translate SoT → portable `IntentFacts` / `SettlementFacts` / `EvidenceFacts`. finance-core never learns gateway brands; interpreter unchanged; unsupported → `unknown` not zero.

### Payment Capability Host Foundation (PR10-B)

See [`FINANCE_CASE_PAYMENT_CAPABILITY.md`](./FINANCE_CASE_PAYMENT_CAPABILITY.md) §PR10-B and `apps/api/src/workspace-finance/case/payment-capability/`.

Host DI selects `ManualPaymentCaseFactProvider` or fake `OnlinePaymentCaseFactProvider` into `CasePaymentFactPort`. No real gateway SDK; no finance-core `paymentMode`.

### Real Online Gateway Adapter (PR10-C)

See [`FINANCE_CASE_PAYMENT_CAPABILITY.md`](./FINANCE_CASE_PAYMENT_CAPABILITY.md) §PR10-C.

`PaymentGatewayPort` + `OnlineGatewayPaymentCaseFactProvider` (+ evidence companion). Webhooks ingest into Host gateway SoT only. Observation sink is non-blocking. finance-core unchanged.

### Finance Capability Reconciliation (PR11-A) — architecture only

See [`FINANCE_CASE_RECONCILIATION.md`](./FINANCE_CASE_RECONCILIATION.md).

Host-owned compare layer between gateway observations and finance SoTs emits portable cues (`reconFinding`, `meaningConflict`, settlement/evidence TriFacts). No Case recon state, no auto-repair, no mutation from recon — resolution only via SoT + Command Bridge. Interpreter / EncounterView / command vocabulary unchanged.

### Host Reconciliation Classifier (PR11-B)

See [`FINANCE_CASE_RECONCILIATION.md`](./FINANCE_CASE_RECONCILIATION.md) §PR11-B and `apps/api/src/workspace-finance/case/reconciliation/`.

Pure Host `classifyPaymentReconciliation` + observation-only cue kinds → Case ledger/signal/lifecycle/payment **read** providers. No SoT writes; finance-core unchanged.

### Denali Composition (PR11-C)

See [`FINANCE_CASE_RECONCILIATION.md`](./FINANCE_CASE_RECONCILIATION.md) §PR11-C and `compose-denali-case-providers.ts`.

Production Denali DI: SoT + optional gateway → payment capability → optional recon cues → execute → EncounterView. Manual default preserved; recon observational only.

### Denali Operator Encounter Wiring (PR12-A)

See [`FINANCE_CASE_OPERATOR_ENCOUNTER_WIRING.md`](./FINANCE_CASE_OPERATOR_ENCOUNTER_WIRING.md).

Host presentation adapter + Denali read-only UI route. UI consumes Encounter presentation only; refresh = new execution; no mutation chrome.

### Denali Encounter Hardening (PR12-B)

See [`FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING.md`](./FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING.md).

finance-http route ownership, rollout flags, fail-open telemetry. No interpretation changes; FinanceService unaffected by Encounter disable.

### Denali Encounter Production Readiness (PR12-C)

See [`FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING.md`](./FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING.md) §PR12-C.

Host-only: rollout strategy states (`disabled`/`internal`/`sampled`/`full`), execution + gateway timeout budgets, report-only health evaluation, vendor-neutral production emitter. No Case persistence; no mutation UI; FinanceService remains independent.

### Denali Encounter Controlled Production Rollout (PR13-A)

See [`FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING.md`](./FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING.md) §PR13-A.

Production decision reasons, operator-read feedback telemetry, health recommendations (never auto-flag), presentation `surfaceState` chrome. finance-core unchanged; FinanceService independent.

### Denali Encounter Pilot Activation (PR13-B)

See [`FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING.md`](./FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING.md) §PR13-B.

Pilot mode + pilot tenant allowlist, observation window / `EncounterRolloutReport` (vendor-neutral, report-only), Denali manual/online/failure validation scenarios. Manual rollout only — no auto-enable/disable.

### Workspace Portability Proof (PR13-C)

See [`FINANCE_CASE_PAYMENT_CAPABILITY.md`](./FINANCE_CASE_PAYMENT_CAPABILITY.md) §PR13-C.

Second workspace adapter **simulation** (marketplace buyer payment) proves: same portable facts → same CaseOutput; finance-core has no workspace identity; adapters own translation; EncounterView contract unchanged. Not a production second workspace.

### Operator Experience (PR7) — architecture only

See [`FINANCE_CASE_OPERATOR_EXPERIENCE.md`](./FINANCE_CASE_OPERATOR_EXPERIENCE.md).

Design gate only: Host UX shell consumes **`CaseEncounterView`** (not raw CaseOutput). Display ≠ decision; signal channel ≠ verdict channel; no UI-authored financial meaning. UI implementation deferred.

### Operator Read-only Surface (PR8-A) — planning only

See [`FINANCE_CASE_OPERATOR_READONLY_SURFACE.md`](./FINANCE_CASE_OPERATOR_READONLY_SURFACE.md).

Implementation planning for the first read-only operator shell on EncounterView. **No** UI code, commands, mutations, or Case persistence in this phase. Success = understandability only.

### Operator Read-only UI (PR8-B) — presentation shell

See [`FINANCE_CASE_OPERATOR_READONLY_SURFACE.md`](./FINANCE_CASE_OPERATOR_READONLY_SURFACE.md) §PR8-B and package `@app-tour/finance-case-encounter-ui`.

Implements read-only sections (Identity, Explanation, Ownership, Confidence, Completeness, Attention) consuming **EncounterView contract only**. Host owns load/refresh; UI never mutates SoTs or invents verdicts.

---

## Fact groups (portable)

| Group | Role |
| ----- | ---- |
| Identity | subject id/kind, case key, counterparty relationship |
| Eligibility | lifecycle eligibility projection |
| Money | obligation, amounts, currency, schedule, collection policy |
| Intent | payment/recurring/manual intent + provenance |
| Evidence | proof existence, progress, source class, inspectability |
| Settlement | captured / unsettled / refunded / disputed meaning |
| Exception cues | conflicts, duplicates, closed+leftover artifacts |
| Audit cues | ledger refs, recon findings |

**Semantics:** `unknown` ≠ `absent` ≠ numeric `zero`. Providers must not coerce failures into zero/absent.

---

## Signals

`EncounterMetadata.attention` may explain **why** an operator opened a subject.

Interpreter **verdict path reads facts only**. Changing signal class with identical facts must not change reading/owner/posture.

---

## A / B / C portability

| Probe | Binding (adapter later) | Core requirement |
| ----- | ----------------------- | ---------------- |
| A Enrollment | registration → subject; member → counterparty; receipt → evidence | Portable facts; no Denali types in core |
| B Subscription | billing cycle; recurring intent; dunning signals | Act/wait without requiring offline receipt |
| C Marketplace | buyer payment / seller payout / dispute | Separate Case keys / snapshots; no merged owner |

---

## Related experience docs

Conceptual experience work (Denali binder context) remains under `docs/workspaces/denali/finance-*.mdoc`. Those docs do not redefine this core boundary; Denali remains an adapter.

**Platform operator experience (PR7):** [`FINANCE_CASE_OPERATOR_EXPERIENCE.md`](./FINANCE_CASE_OPERATOR_EXPERIENCE.md) — portable EncounterView consumption shell; supersedes any Denali-only UX that would re-interpret ownership or money meaning in the client.

---

### Denali → Case fact mapping (PR4-A)

| Rule | Proof |
| ---- | ----- |
| Opaque ids only | Registration / member / tour domain types never enter fact contracts; string ids only |
| Known zero ≠ unknown | `remaining: known("0")` only when SoT proves zero; read failure → `unknown` |
| Absent ≠ unknown | Missing receipt row → `proofExists: absent`; store unavailable → `unknown` |
| No interpretation | Mappers/providers must not import `interpret/`, `rules/`, or `CaseOutput` |
| Signals segregated | Signal mapper emits encounter attention only — never mutates CaseFacts |
| finance-core ↔ Denali | finance-core never imports Denali; Denali never imports Case interpreter |

**PR4-A ships:** pure mappers + host provider façades over injectable SoT DTOs.  
**PR4.5-B ships:** `@app-tour/finance-core/case` surface + host provider factory + optional shadow seam.  
**PR4.5-C ships:** live `HostDenaliCaseReadSource` + Denali FinanceService observational wrap + observation sink.  
**PR5-A ships:** host comparison engine (CaseOutput vs operational classification) + sampling controls + comparison telemetry.  
**PR5-B ships:** production observation sink, mismatch calibration classes, fact coverage report, report-only quality gates, trigger/cost controls.  
**PR6-A ships:** read-only `CaseEncounterView` projection (`projectCaseEncounter`) on `./case` — no UI / API / repository.  
**PR6-B ships (docs only):** Command Bridge architecture — ownership matrix, dependency direction, re-execution contract, failure model, A/B/C portability. See [`FINANCE_CASE_COMMAND_BRIDGE.md`](./FINANCE_CASE_COMMAND_BRIDGE.md).  
**PR7 ships (docs only):** Operator Experience architecture — EncounterView consumption, IA, signal separation, multi-case chooser, forbidden UX patterns. See [`FINANCE_CASE_OPERATOR_EXPERIENCE.md`](./FINANCE_CASE_OPERATOR_EXPERIENCE.md).  
**PR8-A ships (docs only):** Operator read-only surface plan — component ownership, consumption rules, testing strategy, phased rollout (prototype → pilot → refine; still no commands). See [`FINANCE_CASE_OPERATOR_READONLY_SURFACE.md`](./FINANCE_CASE_OPERATOR_READONLY_SURFACE.md).  
**PR8-B ships:** `@app-tour/finance-case-encounter-ui` — read-only EncounterView screen + Host load/refresh shell; no commands/mutations.  
**PR9-A ships (docs only):** Command Bridge foundation — first-wave SoT mappings, Host mapper plan, authz/re-exec/failure models, safety proofs for later implementation. See [`FINANCE_CASE_COMMAND_BRIDGE_FOUNDATION.md`](./FINANCE_CASE_COMMAND_BRIDGE_FOUNDATION.md).  
**PR9-B ships:** Host `reviewReceipt` command bridge pilot under `apps/api/.../case/command-bridge/` (authz + vocabulary gate + SoT + re-execute). No UI mutation chrome; no other command categories.  
**PR10-A ships (docs only):** Payment capability adapter architecture — manual/online/hybrid selection, adapter contracts, migration path, unknown-not-zero. See [`FINANCE_CASE_PAYMENT_CAPABILITY.md`](./FINANCE_CASE_PAYMENT_CAPABILITY.md).  
**PR10-B ships:** Host payment capability foundation — `ManualPaymentCaseFactProvider`, fake `OnlinePaymentCaseFactProvider`, Host `paymentMode` DI selection into `CasePaymentFactPort`. No real gateway.  
**PR10-C ships:** Real online adapter boundary — `PaymentGatewayPort`, `OnlineGatewayPaymentCaseFactProvider`, webhook→Host SoT ingestion, gateway observation sink. No Stripe SDK in finance-core; no capture/refund commands.  
**PR11-A ships (docs only):** Finance capability reconciliation architecture — ownership, fact categories, conflict taxonomy, resolution boundary, manual/online/hybrid portability. See [`FINANCE_CASE_RECONCILIATION.md`](./FINANCE_CASE_RECONCILIATION.md).  
**PR11-B ships:** Host reconciliation classifier + portable cue emission under `apps/api/.../case/reconciliation/` — observations only; no SoT mutation; no finance-core changes.  
**PR11-C ships:** Denali production composition — `composeDenaliCaseFactProviders` wired into live providers, shadow, and EncounterView load; env capability resolution; taxonomy fixtures.  
**PR12-A ships:** Denali operator Encounter production wiring — Host presentation adapter + HTTP GET + web read-only screen; no mutation / Case persistence. See [`FINANCE_CASE_OPERATOR_ENCOUNTER_WIRING.md`](./FINANCE_CASE_OPERATOR_ENCOUNTER_WIRING.md).  
**PR12-B ships:** Production hardening — finance-http contract ownership, Host rollout flags, fail-open telemetry, safety proofs. See [`FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING.md`](./FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING.md).  
**PR12-C ships:** Production readiness — rollout strategy states, timeout budgets, report-only health, vendor-neutral emitter seam. See [`FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING.md`](./FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING.md).  
**PR13-A ships:** Controlled production rollout + operator feedback — decision reasons, feedback telemetry, health recommendations (manual hold only), presentation surface states. See [`FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING.md`](./FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING.md).  
**PR13-B ships:** Pilot activation + operational validation — pilot mode/tenants, observation window report, Denali scenario proofs. See [`FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING.md`](./FINANCE_CASE_OPERATOR_ENCOUNTER_HARDENING.md).  
**PR13-C ships:** Workspace portability proof — second workspace adapter simulation (marketplace), same-facts → same CaseOutput, adapter isolation proofs. See [`FINANCE_CASE_PAYMENT_CAPABILITY.md`](./FINANCE_CASE_PAYMENT_CAPABILITY.md) §PR13-C.  
**PR14-A ships:** Production Command Bridge architecture — `CaseCommandIntent`, Host authz/vocabulary/stale boundaries, failure taxonomy, `reviewReceipt` only, proofs 1–8. See [`FINANCE_CASE_COMMAND_BRIDGE.md`](./FINANCE_CASE_COMMAND_BRIDGE.md) §PR14-A.  
**PR14-B ships:** Host production wiring — `POST /finance/case/commands/review-receipt`, FinanceService adapter, fail-open telemetry, UI command capability metadata (no buttons), security proofs. See [`FINANCE_CASE_COMMAND_BRIDGE.md`](./FINANCE_CASE_COMMAND_BRIDGE.md) §PR14-B.  
**PR15-A ships:** Validation hardening — Encounter HTTP allowlist for `commandCapability` / `meaningFingerprint`, validation runbook Stages 1–4, API boot investigation notes. See [`FINANCE_CASE_VALIDATION_RUNBOOK.md`](./FINANCE_CASE_VALIDATION_RUNBOOK.md).  
**PR15-B ships:** Denali live Stage 1 smoke — API boot + classic finance mutations green with Case disabled; Stage 2 readiness confirmed without enabling pilot. See [`FINANCE_CASE_VALIDATION_RUNBOOK.md`](./FINANCE_CASE_VALIDATION_RUNBOOK.md) §PR15-B.  
**PR15-C ships:** Denali Encounter pilot activation — single-tenant `MODE=pilot` observation only; isolation + read-only surface + classic finance independence. See [`FINANCE_CASE_VALIDATION_RUNBOOK.md`](./FINANCE_CASE_VALIDATION_RUNBOOK.md) §PR15-C.  
**PR15-D ships:** Fact coverage calibration — live incomplete root-caused to Denali obligation canonical envelope mapping; report-only diagnostics; **FIX adapter coverage** before expand. See [`FINANCE_CASE_ENCOUNTER_FACT_COVERAGE_CALIBRATION.md`](./FINANCE_CASE_ENCOUNTER_FACT_COVERAGE_CALIBRATION.md).  
**PR15-E ships:** Denali obligation adapter coverage — wizard envelope unwrap boundary; live `data.pricing` → money TriFacts; missing/malformed still unknown; pilot CONTINUE (no expand). See [`FINANCE_CASE_ENCOUNTER_FACT_COVERAGE_CALIBRATION.md`](./FINANCE_CASE_ENCOUNTER_FACT_COVERAGE_CALIBRATION.md) §PR15-E.  
**PR15-F ships:** Pilot validation report — verdict/completeness distributions, refresh stability, residual `no_rule_matched` paid+remaining gap; **CONTINUE**. See [`FINANCE_CASE_ENCOUNTER_PILOT_VALIDATION.md`](./FINANCE_CASE_ENCOUNTER_PILOT_VALIDATION.md).  
**PR15-G ships:** Paid-with-remaining calibration — ownership map; Host `meaningConflictProven` for booking-paid vs invoice-remaining; regression A–D; no finance-core mutation. See [`FINANCE_CASE_PAID_WITH_REMAINING_CALIBRATION.md`](./FINANCE_CASE_PAID_WITH_REMAINING_CALIBRATION.md).  
**PR15-H ships:** Optional ledger degradation decision — **ACCEPT**; provider_degradation telemetry; A/B/C proofs; no new readings / no UI severity. See [`FINANCE_CASE_LEDGER_DEGRADATION.md`](./FINANCE_CASE_LEDGER_DEGRADATION.md).  
**PR16-A ships:** Controlled internal rollout preparation — internal config helpers, health report distributions, multi-tenant isolation proofs; **READY_FOR_INTERNAL**. See [`FINANCE_CASE_INTERNAL_ROLLOUT.md`](./FINANCE_CASE_INTERNAL_ROLLOUT.md).  
**PR16-B ships:** Shadow comparison pipeline — fail-closed tenant allowlist, mismatch taxonomy, shadow report; default OFF; finance-core unchanged. See [`FINANCE_CASE_SHADOW_COMPARISON.md`](./FINANCE_CASE_SHADOW_COMPARISON.md).  
**PR16-C ships:** Internal shadow validation + decision gate — parity metrics, isolation/safety proofs, live matrix; **HOLD_FOR_CALIBRATION**. See [`FINANCE_CASE_SHADOW_DECISION_REPORT.md`](./FINANCE_CASE_SHADOW_DECISION_REPORT.md).  
**PR16-D ships:** Semantic calibration (docs only) — `…0529` HOST_MAPPING/CHANGE_HOST_MAPPING; `…0523` SOT_POLICY/KEEP_CASE; next rollout still HOLD. See [`FINANCE_CASE_SEMANTIC_CALIBRATION.md`](./FINANCE_CASE_SEMANTIC_CALIBRATION.md).  
**PR16-E ships:** ADR canonical meaning — **Decision A** (Case = canonical interpreter; legacy Finance may evolve toward it); PR17 operator read integration unblocked architecturally; Decision B rejected. See [`ADR_FINANCE_CASE_CANONICAL_MEANING.md`](./ADR_FINANCE_CASE_CANONICAL_MEANING.md).  
**PR17-A ships:** Finance Command Center Commercial Meaning view — Encounter read-only embed; classic panels preserved; refresh = new execution; no command UI / finance-core in UI. See [`FINANCE_CASE_OPERATOR_EXPERIENCE.md`](./FINANCE_CASE_OPERATOR_EXPERIENCE.md).  
**PR17-B ships:** Meaning embed hardening — stable contract, operator states, hub navigation, fail-open telemetry; readiness A yes / B no / C no. See [`FINANCE_CASE_OPERATOR_EXPERIENCE.md`](./FINANCE_CASE_OPERATOR_EXPERIENCE.md).

**PR17-C ships:** Internal operator Commercial Meaning read under Encounter `MODE=internal`; Meaning feedback health + calibration (report-only); readiness A observing; B/C still closed. See [`FINANCE_CASE_OPERATOR_EXPERIENCE.md`](./FINANCE_CASE_OPERATOR_EXPERIENCE.md) · [`FINANCE_CASE_VALIDATION_RUNBOOK.md`](./FINANCE_CASE_VALIDATION_RUNBOOK.md).

**PR18-A ships:** Command Bridge UX architecture only — surface contract, action model, UX boundary, readiness proofs; **READY_FOR_UI_IMPLEMENTATION**; no buttons / no mutation UI. See [`FINANCE_CASE_COMMAND_BRIDGE.md`](./FINANCE_CASE_COMMAND_BRIDGE.md) §PR18-A.

**PR18-B ships:** Meaning-only `reviewReceipt` Command UI behind single-tenant flag; confirm → Host bridge POST → typed result → force refresh; classic receipts unchanged. See [`FINANCE_CASE_COMMAND_BRIDGE.md`](./FINANCE_CASE_COMMAND_BRIDGE.md) §PR18-B.

**PR18-C ships:** Single-tenant internal Command UI validation evidence (live smoke + proofs); **READY_FOR_CONTROLLED_PRODUCTION** for tenant `…000003` only; no vocabulary expand; classic review retained. See [`FINANCE_CASE_VALIDATION_RUNBOOK.md`](./FINANCE_CASE_VALIDATION_RUNBOOK.md) §PR18-C.

**PR19 ships:** Controlled production observation health report + recommendation; live evidence **CONTINUE** for tenant `…000003`; no vocabulary expand; no multi-tenant; shadow remains off. See [`FINANCE_CASE_VALIDATION_RUNBOOK.md`](./FINANCE_CASE_VALIDATION_RUNBOOK.md) §PR19.

**PR20 ships:** Controlled LIVE Command UI usage observation; **CONTINUE**; classic vs command comparison; `SOT_POLICY` residual noted. See [`FINANCE_CASE_VALIDATION_RUNBOOK.md`](./FINANCE_CASE_VALIDATION_RUNBOOK.md) §PR20.

**PR20-A ships:** Command observation completion gate — **3 LIVE** successes; EXCEPTION residual = `SOT_POLICY` (repeatable); **CONTINUE**; no auto-expand. See [`FINANCE_CASE_VALIDATION_RUNBOOK.md`](./FINANCE_CASE_VALIDATION_RUNBOOK.md) §PR20-A.

**PR20-B ships:** SoT paid-vs-remaining policy **fix** — underpay approve → `partial`, full → `paid`; **KEEP_CASE**; rollout **CONTINUE** (no auto-expand). See [`FINANCE_CASE_SOT_PAID_VS_REMAINING_POLICY.md`](./FINANCE_CASE_SOT_PAID_VS_REMAINING_POLICY.md).

**Still deferred:** Host recon auto-repair (forbidden), vendor Stripe SDK package, capture/refund/chargeback, hybrid composite, other SoT command categories, Prisma Case tables, auto-approvals, Fact Summary companion, multi-tenant Command UI.

---

## PR1–PR20-A non-goals

- Production inbox productization / full OpenAPI Case product suite (Encounter route stabilized under finance-http)
- Prisma / Case persistence / Case status rows / Case repository / Case history
- Payment repair from Case / lifecycle writes owned by Case / settlement engine
- Root-barrel export of Case (only `./case` subpath)
- Reuse of workflow **command** ports as Case reads
- Interpretation inside adapters, Encounter projection, **or UI**
- FinanceService replacement (observational wrap only)
- Auto-fixing workflows / automatic approvals
- Quality gates that block primary requests
- Subscription / marketplace adapters (Denali enrollment binder only)
- Encounter layer owning ownership / posture / confidence *rules*
- finance-core importing Denali/Prisma command surfaces **or payment provider SDKs**
- Optimistic Case state / “Case approved” lifecycle
- UI consuming raw CaseOutput or FactSnapshot as the operator contract
- UI-authored explanation / owner inference / signal→verdict conflation
- Approve/reject **UI buttons** / Command Bridge chrome (PR14-B ships capability metadata + HTTP bridge only)
- Operator ownership override / bulk operations / automatic Case actions
- Command categories other than `reviewReceipt` (`approve_evidence` / `reject_evidence`)
- Case ownership of workflows / Case rollback / Case persistence from bridge failures
- Client-posted raw SoT command bodies (intent-only HTTP)
- Stripe SDK **inside finance-core** / Case webhook consumers
- Capture / refund / chargeback **commands** (PR10-C is read adapter only)
- Changing interpreter laws to encode manual vs online as Case readings
- Hybrid composite payment adapter / multi-gateway marketplace routing
- UI payment / checkout screens
- **finance-core reconciliation state** / Case payment lifecycle store
- **Auto-repair** from gateway↔SoT mismatch (detect + cue only)
- Recon dashboard / retry engine / settlement automation
- Operator comments / Case history
- Telemetry as Case / ownership / workflow state
