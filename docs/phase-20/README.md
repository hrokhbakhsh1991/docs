# Phase 20 — P7 Denali customer live

```yaml
phase: 20
pack: P7
pack_version: "1.4"
status: IN_PROGRESS
current_task: P7-0-N-002
nano_spec_total: 27
nano_staging_done: 1
nano_total: 27
prerequisite: P6 complete (pnpm run p6:gate)
p7_gate: pnpm run p7:gate
p7_staging_gate: pnpm run p7:staging-gate
doc_quality_target: "90"
doc_architecture: p7/appendices/P7-DOC-ARCHITECTURE.md
execution_discipline: p7/appendices/P7-EXECUTION-DISCIPLINE.md
north_star: first Denali club customer live on staging
machine_snapshot: p7/AGENT-CURRENT-PHASE.yaml
doc_sot: platform-denali-customer-delivery.mdoc
```

## Start

→ [p7/AGENT-START.md](p7/AGENT-START.md) · [AGENT-NAVIGATOR.md](AGENT-NAVIGATOR.md)

## Umbrella

→ [platform-denali-customer-delivery.mdoc](platform-denali-customer-delivery.mdoc)

## Prerequisite

**P6 closed** — 58/58 · `docs/phase-19/p6/p6-exit-checklist.md`

## EPICs

| EPIC | Doc | Focus |
| ---- | --- | ----- |
| P7-0 | [p7/p7-0-live-infra.md](p7/p7-0-live-infra.md) | Staging · seed · env · four-process |
| P7-1 | [p7/p7-1-wizard-completion.md](p7/p7-1-wizard-completion.md) | Wizard P0 blockers |
| P7-2 | [p7/p7-2-workspace-ops.md](p7/p7-2-workspace-ops.md) | Workspace ops staging |
| P7-3 | [p7/p7-3-delivery-exit.md](p7/p7-3-delivery-exit.md) | T2/T3/T4 · sign-off |

## Progress

→ [p7/DOC-SYNC-INDEX.md](p7/DOC-SYNC-INDEX.md) · [p7/p7-exit-checklist.md](p7/p7-exit-checklist.md) · [p7/FILE-MAP.md](p7/FILE-MAP.md)

## After P7 (PLANNED)

→ [POST-P7-PLATFORM-ROADMAP.md](../POST-P7-PLATFORM-ROADMAP.md) — P8 · P9 · P10 infra standardization

| Pack | Folder |
| ---- | ------ |
| P8 | [../phase-21/](../phase-21/) |
| P9 | [../phase-22/](../phase-22/) |
| P10 | [../phase-23/](../phase-23/) |

## Not in P7 v0.1

Urban · Super Admin · gateway/Stripe · metadata platform · wizard redesign · merge three apps
