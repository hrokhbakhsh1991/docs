# Finance Case Operator Experience (PR7 → PR19)

```yaml
doc_id: FINANCE_CASE_OPERATOR_EXPERIENCE
version: "2026-08-08-v10"
status: CONTROLLED_COMMAND_USAGE_OBSERVATION
phase: PR20-A — command observation completion gate
authority: >
  ADR_FINANCE_CASE_CANONICAL_MEANING (Decision A) ·
  FINANCE_CASE_INTERPRETER_BOUNDARY · FINANCE_CASE_COMMAND_BRIDGE ·
  PR8-B Encounter UI · PR12-A Encounter wiring · PR16-A Internal Rollout ·
  PR16-E · PR17-A…C · PR14-B Host bridge · PR18-A UX architecture
related:
  - docs/phase-20/p7/appendices/ADR_FINANCE_CASE_CANONICAL_MEANING.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_INTERPRETER_BOUNDARY.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_COMMAND_BRIDGE.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_INTERNAL_ROLLOUT.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_VALIDATION_RUNBOOK.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_OPERATOR_READONLY_SURFACE.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_OPERATOR_ENCOUNTER_WIRING.md
  - apps/web/app/(app)/finance/finance-command-center.tsx
  - apps/web/src/finance/finance-commercial-meaning-contract.ts
  - apps/web/src/finance/finance-commercial-meaning-embed.tsx
  - apps/web/src/finance/finance-commercial-meaning-telemetry.ts
  - apps/web/src/finance/finance-command-bridge-ux-architecture.ts
  - apps/web/src/finance/finance-case-command-ui-rollout.ts
  - apps/web/src/finance/finance-case-command-review-receipt-ui.tsx
  - apps/web/app/api/finance/case/commands/review-receipt/route.ts
  - packages/finance-case-encounter-ui/
locks:
  finance-core: unchanged
  finance_service: unchanged
  case_persistence: forbidden
  capture_refund_settlement_ui: forbidden
  bulk_actions: forbidden
  auto_execution: forbidden
  optimistic_meaning: forbidden
  capability_grants_permission: false
  command_ui_default: false
  command_ui_tenants: single_only
  classic_panel_replacement: forbidden
  case_output_in_ui: forbidden
  rollout_automation: forbidden
```

## Purpose

Commercial Meaning is the canonical **read** surface (EncounterView). PR18-B adds the first **Command Bridge UI** for `reviewReceipt` only — discover → confirm → Host bridge POST → typed result → force Encounter refresh — behind a fail-closed single-tenant flag.

Per ADR Decision A: Case = canonical commercial meaning; FinanceService = mutation authority.

---

## Embedding contract (PR17-B)

Stable Command Center ↔ Encounter seam:

| Field | Role |
| ----- | ---- |
| `registrationId` | Opaque subject id (query only) — never Case key as navigation authority |
| `counterpartyId` | Optional Host hint for load / command payload |
| `encounter` | `CaseEncounterViewContract` presentation only |
| `surfaceState` | `normal` \| `degraded` \| `incomplete` (+ host chrome `loading` / `unavailable`) |
| `executionId` | Opaque Host execution id; **changes on every refresh** |
| `commandCapability` | Discovery metadata (tokens + endpoint) — **not** permission |
| `meaningFingerprint` | Stale-intent seam for Command Bridge POST |

**Forbidden on this seam:** CaseOutput, FactSnapshot, gateway DTOs, finance-core imports in `apps/web`.

Module: `finance-commercial-meaning-contract.ts` + `FinanceCommercialMeaningEmbed` + `DenaliCaseEncounterPanel`.

---

## Operator workflow

```text
Finance Command Center
        │
        ├─ View: Operational  ──► classic tabs (unchanged mutation surfaces)
        │                         + deep-link “Commercial Meaning” when registration scoped
        │
        └─ View: Commercial Meaning ──► FinanceCommercialMeaningEmbed
                                         registrationId required
                                         load/refresh → new executionId
                                         + reviewReceipt Command UI when flag+tenant match
```

Deep links:

- Hub: `/finance?view=meaning&registrationId=<id>`
- From booking strip / operational context via `buildFinanceCommercialMeaningHref`

Standalone `/finance/case/[registrationId]` remains available.

---

## Operator surface states

| State | Operator meaning | UI |
| ----- | ---------------- | -- |
| `loading` | Fetch / execute in flight | Host chrome + status |
| `unavailable` | Authz / not found / error / **timeout** | Alert; refresh allowed |
| `degraded` | Optional providers degraded; reading still shown | Surface banner + Encounter |
| `incomplete` | Coverage incomplete / inspect forced | Surface banner + Encounter |
| `normal` | Healthy presentation | Encounter sections |

States are **display chrome**, not verdicts. Telemetry mirrors these for ops — never auto-flips rollout flags.

---

## Refresh model

| Action | Behavior |
| ------ | -------- |
| Mount / Open Meaning | New Host GET → new `executionId` |
| Refresh button | Re-invoke loader; never patch Encounter fields client-side |
| After successful command | Force remount / re-GET Meaning (new `executionId`) — **no optimistic patch** |
| Timeout | Fail-open → `unavailable` + telemetry `timeout` |

---

## Observability (fail-open)

Events (no PII beyond opaque registrationId / executionId):

| Event | When |
| ----- | ---- |
| `meaning_opened` | Meaning view mounted with registrationId |
| `meaning_viewed` | Successful load (`normal` / `degraded` / `incomplete`) |
| `meaning_unavailable` | Error / authz / not found |
| `meaning_timeout` | Client load timeout |
| `meaning_degraded` | `surfaceState=degraded` |
| `meaning_incomplete` | `surfaceState=incomplete` |
| `operator_returned_to_operational_view` | Operator leaves Meaning → Operational View |

Sink: `emitFinanceCommercialMeaningTelemetry` — swallows all sink errors; **no rollout automation**.

---

## Internal operator read rollout (PR17-C)

Commercial Meaning **reuses** Encounter Host gates — no separate Meaning env flag.
PR17-C readiness stays **READY_FOR_COMMAND_UI_PREP** only: report-only health/calibration,
manual flag flips, and no rollout automation.

| Control | Env / behavior |
| ------- | -------------- |
| Activation | `FINANCE_CASE_ENCOUNTER_MODE=internal` |
| Allowlist | `FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS` (fail-closed when empty) |
| Emergency disable | `FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE` → zero Case execution |
| Shadow | `FINANCE_CASE_SHADOW_ENABLED=false` (keep off) |

See validation runbook §PR17-C for health report + feedback calibration (report-only).

---

## Command Bridge UX architecture (PR18-A)

See [`FINANCE_CASE_COMMAND_BRIDGE.md`](./FINANCE_CASE_COMMAND_BRIDGE.md) §PR18-A.

Layers: **discovery** (`commandCapability`) ≠ **permission** (Host session) ≠ **intent** (operator) ≠ **execution** (Host bridge → FinanceService).

Module: `finance-command-bridge-ux-architecture.ts` (`grantsPermission: false`, `mayExecute: false`).

---

## reviewReceipt Command UI (PR18-B)

See [`FINANCE_CASE_COMMAND_BRIDGE.md`](./FINANCE_CASE_COMMAND_BRIDGE.md) §PR18-B.

### Rollout (fail-closed, single tenant)

```bash
FINANCE_CASE_COMMAND_UI_ENABLED=true
FINANCE_CASE_COMMAND_UI_TENANT=<exactly-one-tenant-uuid>
```

Chrome renders only when both are set and `session.tenantId` matches. Default **off**.

### Flow

1. Discover tokens from `commandCapability` (Case-coherent only)
2. Operator picks pending SoT `receiptId` (+ `counterpartyId`)
3. **Confirm** required (no one-click)
4. Build intent body → `POST /api/finance/case/commands/review-receipt`
5. Show typed success/failure
6. On success (and on stale / reexecute_failed): **force Meaning refresh**

### Failure UX

`auth_denied` · `vocabulary_denied` · `concurrency_conflict` · `sot_rejected` · `provider_unavailable` · `reexecute_failed`

### Non-goals (still)

- capture / refund / settlement commands  
- bulk / auto-execute  
- optimistic Meaning edits  
- finance-core / FinanceService changes  
- Case persistence  
- Replacing classic Operational receipts tab  

---

## Commercial vs operational separation

| Concern | Commercial Meaning | Operational View |
| ------- | ------------------ | ---------------- |
| Truth | Case interpretation | FinanceService / SoT lists |
| Mutations | `reviewReceipt` via Command Bridge only (flagged) | Classic payments / receipts / etc. |
| Navigation | `view=meaning` | `view` unset / operational + `tab=` |
| Refresh | New Case execution | Panel list refetch |

---

## Safety boundaries

| Rule | Proof |
| ---- | ----- |
| EncounterView-only for Meaning read | Embed + panel type guards |
| No finance-core Case internals in web | Spec scans imports |
| No CaseOutput / FactSnapshot | Spec + HTTP allowlist |
| No direct FinanceService from UI | Command UI posts BFF only |
| Capability ≠ permission | `commandCapabilityGrantsPermission` → false |
| No optimistic mutation | Success remounts Meaning |
| Classic receipts remain | Operational panel unchanged |

---

## Readiness (post PR18-C)

| Track | Ready? | Note |
| ----- | ------ | ---- |
| **A) Internal operator read rollout** | **Activated** | Encounter `MODE=internal` for `…000003` |
| **B) Command bridge UI** | **Single-tenant validation** | `reviewReceipt` only; classic path kept |
| **C) Production default enablement** | **No** | No multi-tenant Command UI; no vocabulary expand |

### PR18-C verdict

| Verdict | When |
| ------- | ---- |
| **CONTINUE** | Observation window; residuals non-blocking |
| **HOLD** | Blocking safety/SoT defect |
| **READY_FOR_CONTROLLED_PRODUCTION** | Single validated tenant may keep Command UI on |

**Decision: READY_FOR_CONTROLLED_PRODUCTION** (tenant `…000003` only).

Live smoke (`scripts/pr18c-denali-command-ui-smoke.sh`, 2026-08-07): Meaning confirm → BFF → Host → FinanceService approve on receipt `…000931` / reg `…000531`; booking unpaid→paid; classic pending parity; stale replay + classic-then-stale both `CASE_COMMAND_STALE`; unauthorized API call 401; Command UI fail-closed for other/empty/multi tenant. Classic Receipts path kept. No vocabulary expand. Full matrix in [`FINANCE_CASE_VALIDATION_RUNBOOK.md`](./FINANCE_CASE_VALIDATION_RUNBOOK.md) §PR18-C.

---

## PR19 — Controlled production observation

| Track | Status |
| ----- | ------ |
| Single-tenant Command UI | Remains on for `…000003` only |
| Observation | Meaning + `reviewReceipt` + classic review + safety |
| Expansion | **Advisory only** — never auto-enable second tenant / shadow / new commands |

### Observation recommendation vocabulary

| Verdict | Meaning |
| ------- | ------- |
| **CONTINUE** | Keep single-tenant controlled production; residuals non-blocking |
| **HOLD** | Blocking safety / availability / SoT risk |
| **READY_FOR_EXPANSION** | Advisory readiness to consider a later multi-tenant / vocab proposal — still requires Architect YES |

**PR19 decision: CONTINUE** (tenant `…000003` only).

Live observation (`scripts/pr19-denali-controlled-production-observation.sh`, 2026-08-08): 8/8 Meaning samples; availability 1.0; EXCEPTION/INCOMPLETE 0; refresh rotates `executionId`; auth 401; isolation fail-closed; no risk indicators. Command submits not forced in this window (PR18-C remains the LIVE command proof). Do **not** expand tenants/vocabulary/shadow without Architect YES. Details: [`FINANCE_CASE_VALIDATION_RUNBOOK.md`](./FINANCE_CASE_VALIDATION_RUNBOOK.md) §PR19.


---

## PR20 — Controlled command usage observation

Collect LIVE Command UI approve/reject/stale/auth/isolation evidence. Operator signals are observable only (confirm/cancel/retry/latencies). Report **NO_HUMAN_FEEDBACK** when no human interview exists.

**PR20 decision: CONTINUE** (tenant `…000003`). LIVE approve+reject+stale+auth+isolation; **NO_HUMAN_FEEDBACK**. See runbook §PR20.


---

## PR20-A — Command observation completion gate

Obtain ≥1 additional LIVE successful Command UI mutation on `…000003` to complete the advisory floor (≥3). **NO_HUMAN_FEEDBACK** unless an operator interview exists.

### Operator-facing evidence

| Signal | Observation |
| ------ | ----------- |
| Third Command UI approve | LIVE success on `…518`; Meaning panel refreshed to **EXCEPTION** after SoT paid sync |
| Confirmation / cancel | confirmationCompletion cumulative **3**; cancellations **0** |
| Stale UX | Command refused **409** after classic review; operator must re-open Meaning |
| Classic path | Still available; no Command-only mutation authority |
| Human interview | **NO_HUMAN_FEEDBACK** |

Post-approve EXCEPTION with empty Command tokens remains the commercial pause signal (not a UI bug). Classic may still act under EXCEPTION (`CLASSIC_UI_BEHAVIOR` from PR20) while Command stays Meaning-gated.

### PR20-A decision

**CONTINUE** — keep single-tenant Command UI on `…000003`. Floor met; do not expand tenants. See runbook §PR20-A.
