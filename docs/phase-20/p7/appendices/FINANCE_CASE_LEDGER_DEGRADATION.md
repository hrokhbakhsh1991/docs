# Finance Case Optional Ledger Degradation (PR15-H)

```yaml
doc_id: FINANCE_CASE_LEDGER_DEGRADATION
version: "2026-08-07-v1"
status: DECISION
phase: PR15-H
pilot_tenant: "00000000-0000-4000-8000-000000000003"
related:
  - docs/phase-20/p7/appendices/FINANCE_CASE_ENCOUNTER_PILOT_VALIDATION.md
  - docs/phase-20/p7/appendices/FINANCE_CASE_INTERPRETER_BOUNDARY.md
  - apps/api/src/workspace-finance/case/encounter/encounter-telemetry.ts
  - apps/api/src/workspace-finance/case-read/denali-ledger-fact.provider.ts
  - packages/workspaces/denali/src/finance/case-read/map-ledger-facts.ts
locks:
  finance-core: unchanged
  new_case_readings: forbidden
  ui_severity_invention: forbidden
  blocking_completeness_from_optional_ledger: forbidden
  shadow: false
  tenant_expand: false
  command_ui: false
```

## Purpose

Finalize whether live `ledger_read_failed` / optional ledger degradation requires adapter fixes, telemetry, or rollout hold — without changing finance-core laws or inventing UI severity.

---

## Classification — ledger dependency

| Question | Answer |
| -------- | ------ |
| Required for Case **verdict** (reading)? | **No** — interpret path uses eligibility / money / evidence / intent / settlement / exception cues; audit cues only raise altitude when `reconFinding=mismatch` is **known** |
| Required for **completeness**? | **No** — `evaluateCompleteness` never inspects `auditCues.*` |
| Observation-only? | **Yes** — `AuditCueFacts` are optional audit discovery; provider marked optional in Host diagnostics (`required: false`) |

### Live pilot evidence (post PR15-E/G)

| Signal | Value |
| ------ | ----- |
| Incomplete rate | **0%** (n=9) while ledger+signal still often degraded under parallel assemble |
| Required unknowns | empty |
| Surface state | `normal` for successful readings (optional ledger fail does **not** force incomplete chrome) |
| Solo `readLedger` | often **ok** |
| Parallel assemble | ledger/signal frequently `unavailable` → mapper `ledger_read_failed` (Host catch / concurrent RLS contention) |

Ledger degradation is therefore **observation noise / Host reliability**, not a Case meaning defect.

---

## Scenario contract

| ID | Condition | Expected |
| -- | --------- | -------- |
| **A** | Ledger available (`readStatus=ok`, known refs/recon) | Same reading as required facts alone; Encounter `normal` when completeness allows |
| **B** | Ledger unavailable (`failed` / provider degraded) | **Same verdict** if required facts exist; `degradedProviders` includes `ledger`; audit cues unknown — **not** inspect_forced from ledger alone |
| **C** | Ledger malformed / failed map | `unknownAuditCues("ledger_read_failed"|"…")` — **never** fake `ledgerRefsPresent=true` or invent recon mismatch |

Signal (discovery attention) follows the same optional rule: failure → null attention, not a new reading.

---

## Telemetry decision

### Track (Host Encounter telemetry — fail-open)

| Field | Purpose |
| ----- | ------- |
| Frequency | count of `provider_degradation` events per provider |
| Affected tenants | `tenantId` on each event → `tenantsSeen` / rollup |
| Latency impact | optional `latencyMs` when measured; else correlate with `encounter_total` |
| Failure reason | `unavailable` \| `timeout` \| `not_found` \| `unsupported` \| `ledger_read_failed` (reason code only — no CaseOutput) |

### Event shape

`EncounterTelemetryEvent` kind `provider_degradation`:

- `provider`: `ledger` \| `signal` \| `obligation` \| `payment` \| `evidence` \| `lifecycle`
- `failureReason`: opaque string reason code
- `optional`: `true` for ledger/signal
- never carries readings, money amounts, or FactSnapshot

### Explicit non-goals

- Do **not** map optional ledger fail → HTTP surface `degraded` / new UI severity chrome
- Do **not** block completeness or invent Case readings from audit unknowns
- Do **not** require production sink for pilot CONTINUE (fail-open if unset)

---

## Decision

### **ACCEPT degradation** (Case semantics)

Optional ledger (and signal) may degrade without changing pilot verdicts or completeness. Pilot **CONTINUE**.

### Not chosen

| Option | Why not |
| ------ | ------- |
| **FIX adapter** (blocking) | Concurrent RLS / `aggregateId`≠registrationId are real Host follow-ups, but they do **not** block Case meaning; fixing them is quality work, not a gate for ACCEPT |
| **HOLD rollout** | Pilot readings are useful; incomplete rate 0%; optional fail is fail-open by design |

### Deferred Host follow-ups (non-blocking)

1. Concurrent `withTenantRls` contention when six providers hit Prisma in parallel — serialize or pool-safe ledger/signal after required providers (Host-only; no finance-core assemble change required if Host caches ledger read).
2. Ledger ref match: outbox `aggregateId` is often journal id; registration lives in `payload.registrationId` — false-negative `ledgerRefsPresent=false` when read succeeds.
3. Wire default production telemetry sink for pilot window aggregation (still fail-open).

---

## Recommendation

**ACCEPT degradation** + **telemetry instrumentation** for observation.  
Rollout stance: **CONTINUE** single-tenant pilot — not HOLD, not expand, no shadow, no command UI.
