# Phase 4 — AI execution hub

```yaml
agent_entry: phase-4-ai-exec.md
sole_execution_entry: phase-4-ai-exec.md
load_tiers: appendices/agent-load-tiers.md
fail_token: FAIL
```

**Optimization:** [`AI-READABILITY-REPORT.md`](AI-READABILITY-REPORT.md) · **Gap register (7):** [`audits/PHASE-4-GAP-REGISTER.md`](audits/PHASE-4-GAP-REGISTER.md) · **Truth:** [`audits/IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md) · **Future board:** [`FUTURE-PROOFING-REPORT.md`](FUTURE-PROOFING-REPORT.md)

**Scores (2026-06-04):** **doc 100** (precision pack pre-code) · **execution 29** · weighted **~74** until code  
**Precision pack:** [`appendices/PRECISION-DOC-INDEX.md`](appendices/PRECISION-DOC-INDEX.md) · closure: [`audits/CLOSURE-CHECKLIST.md`](audits/CLOSURE-CHECKLIST.md)

## Agent load (deterministic)

| Tier   | When                          | Files                                                                                                   |
| ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| **T0** | Implement / validate subphase | `phase-4-ai-exec.md` + `subphases/{id}.md` + `phase-4-enforcement.md` + `audits/verification-matrix.md` |
| **T1** | Gate debug / 4.6              | + `ci.md`, `phase-4-guard.md`                                                                           |
| **T2** | Architecture dispute          | + `phase-4-overview.md`, `phase-4-state-machine.md`                                                     |
| **T3** | Humans only                   | `phase-4-tenant-kernel.md`                                                                              |

**RULE:** T0 tasks loading `phase-4-overview.md` → **FAIL**

## Canonical entrypoints

| Role          | File                                                                         |
| ------------- | ---------------------------------------------------------------------------- |
| Agent router  | [`phase-4-ai-exec.md`](phase-4-ai-exec.md)                                   |
| Index + DRIFT | [`phase-4.ai-exec.index.md`](phase-4.ai-exec.index.md)                       |
| Cold start    | [`../phase-4-tenant-kernel.ai-exec.md`](../phase-4-tenant-kernel.ai-exec.md) |

## Knowledge ownership (no duplicates)

[`appendices/knowledge-index.md`](appendices/knowledge-index.md)

## Execution DAG

```text
4.0 → 4.1 → 4.2 → 4.3 → 4.6
              ├→ 4.4 ∥ 4.5
```

[`audits/subphase-enforcement-map.md`](audits/subphase-enforcement-map.md) · [`audits/execution-action-index.md`](audits/execution-action-index.md)

## Modules

| Module                              | File                                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| P4-E-\* · forbidden · DoD           | [`phase-4-enforcement.md`](phase-4-enforcement.md)                                                 |
| CI                                  | [`ci.md`](ci.md)                                                                                   |
| p4\_\*                              | [`phase-4-guard.md`](phase-4-guard.md)                                                             |
| Verification                        | [`audits/verification-matrix.md`](audits/verification-matrix.md)                                   |
| Traceability (R→A→V→C)              | [`audits/TRACEABILITY-MATRIX.md`](audits/TRACEABILITY-MATRIX.md)                                   |
| Consistency audit                   | [`audits/CONSISTENCY-REPORT.md`](audits/CONSISTENCY-REPORT.md)                                     |
| Subphases                           | [`subphases/`](subphases/)                                                                         |
| Verification commands               | [`appendices/verification-commands.md`](appendices/verification-commands.md)                       |
| Legacy ↔ app-tour bridge            | [`appendices/legacy-structure-bridge.md`](appendices/legacy-structure-bridge.md)                   |
| Completion proof schema             | [`appendices/subphase-completion-schema.md`](appendices/subphase-completion-schema.md)             |
| Workspace interoperability          | [`appendices/workspace-interoperability-model.md`](appendices/workspace-interoperability-model.md) |
| Industry alignment (2026)           | [`appendices/industry-alignment-2026.md`](appendices/industry-alignment-2026.md)                   |
| Implementation truth (repo honesty) | [`audits/IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md)                                 |
| Anti-hollow contract                | [`appendices/anti-hollow-contract.md`](appendices/anti-hollow-contract.md)                         |
| Observability scaffold              | [`appendices/observability.md`](appendices/observability.md)                                       |

## Phase 5 handoff

After **4.6** and `phase_5_entry_requires_modular` in [`phase-4-enforcement.md`](phase-4-enforcement.md):

| Doc                                                                                                | Role                                   |
| -------------------------------------------------------------------------------------------------- | -------------------------------------- |
| [`../appendices/PLATFORM-CONTINUITY-0-5.md`](../appendices/PLATFORM-CONTINUITY-0-5.md)             | Canonical 0→5 ownership                |
| [`appendices/phase-handoff-3-4-5.md`](appendices/phase-handoff-3-4-5.md)                           | 3→4→5 artifact table                   |
| [`../phase-5/phase-5-agent-router.md`](../phase-5/phase-5-agent-router.md)                         | **SOLE** Phase 5 entry                 |
| [`../phase-5/appendices/CROSS-PHASE-ENTRY-MAP.md`](../phase-5/appendices/CROSS-PHASE-ENTRY-MAP.md) | `phase_5_entry_requires_modular` ↔ 5.0 |

## Human + Markdoc

- [`../phase-4-tenant-kernel.md`](../phase-4-tenant-kernel.md)
- [`../phase-4-tenant-kernel.mdoc`](../phase-4-tenant-kernel.mdoc)
