# Phase 0 — AI execution documentation hub

Modular **AI-execution** spec. Narrative: [`../phase-0-foundation.md`](../phase-0-foundation.md) · Markdoc: [`../phase-0-foundation.mdoc`](../phase-0-foundation.mdoc).

## Canonical entrypoint

- **Central index (agents):** [`../phase-0-foundation.ai-exec.md`](../phase-0-foundation.ai-exec.md)
- **Detailed modules:** [`phase-0.ai-exec.index.md`](phase-0.ai-exec.index.md)

## Navigation

| File                                                                         | Contents                                                          |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [`phase-0.ai-exec.index.md`](phase-0.ai-exec.index.md)                       | `document_meta`, AGENT_START_SEQUENCE, doc drift, fail conditions |
| [`phase-0-overview.md`](phase-0-overview.md)                                 | Phase detection · §1–§3 · L-1..L-10                               |
| [`phase-0-state-machine.md`](phase-0-state-machine.md)                       | State model · DAG                                                 |
| [`phase-0-enforcement.md`](phase-0-enforcement.md)                           | Forbidden · DoD · Phase 1 entry · completion                      |
| [`phase-0-guards.md`](phase-0-guards.md)                                     | Covenant 10 + `g4` `g4b` `g6` `g7`                                |
| [`phase-0-ci.md`](phase-0-ci.md)                                             | `phase-0:gate` foundation + integration                           |
| [`subphases/0.1-legacy-archive.md`](subphases/0.1-legacy-archive.md)         | §0.1                                                              |
| [`subphases/0.2-workspace-sdk.md`](subphases/0.2-workspace-sdk.md)           | §0.2                                                              |
| [`subphases/0.3-architecture-guard.md`](subphases/0.3-architecture-guard.md) | §0.3                                                              |
| [`subphases/0.4-documentation.md`](subphases/0.4-documentation.md)           | §0.4                                                              |
| [`subphases/0.5-ci-gate.md`](subphases/0.5-ci-gate.md)                       | §0.5                                                              |
| [`subphases/0.6-baseline-metrics.md`](subphases/0.6-baseline-metrics.md)     | §0.6                                                              |
| [`audits/forensic-template.md`](audits/forensic-template.md)                 | FT-\* forensic rules                                              |
| [`audits/verification-matrix.md`](audits/verification-matrix.md)             | P0-E-\* map                                                       |
| [`appendices/`](appendices/)                                                 | SDK tree · commands · export map · DAG                            |

## Cross-phase continuity

Foundation artifacts feed Phase 5 (`CanonicalDocument`, SDK). Canonical hub: [`../appendices/PLATFORM-CONTINUITY-0-5.md`](../appendices/PLATFORM-CONTINUITY-0-5.md) · Phase 5 bridge: [`../phase-5/appendices/phase-0-3-bridge.md`](../phase-5/appendices/phase-0-3-bridge.md)

## Agent load order

1. [`phase-0.ai-exec.index.md`](phase-0.ai-exec.index.md)
2. [`phase-0-state-machine.md`](phase-0-state-machine.md)
3. [`phase-0-guards.md`](phase-0-guards.md) + [`phase-0-enforcement.md`](phase-0-enforcement.md)
4. Active [`subphases/`](subphases/) file
5. [`phase-0-ci.md`](phase-0-ci.md) before merge / 0.5

**Rule:** `pnpm run phase-0:gate` = `phase-0:foundation-gate` + `phase-0:integration-gate` per `package.json`.

## Validation

- [`QUALITY-VALIDATION.md`](QUALITY-VALIDATION.md) — Phase 0 quality pass
- [`../phases/DOCUMENTATION-CURATION-VALIDATION.md`](../phases/DOCUMENTATION-CURATION-VALIDATION.md) — cross-phase curation
