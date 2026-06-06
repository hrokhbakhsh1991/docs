# Phase 1 — AI execution documentation hub

Modular **AI-execution** spec. Narrative: [`../phase-1-platform-core.md`](../phase-1-platform-core.md) · Markdoc: [`../phase-1-platform-core.mdoc`](../phase-1-platform-core.mdoc).

## Canonical entrypoint

- **Central index (agents):** [`../phase-1-platform-core.ai-exec.md`](../phase-1-platform-core.ai-exec.md)
- **Detailed modules:** [`phase-1.ai-exec.index.md`](phase-1.ai-exec.index.md)

## Navigation

| File                                                                       | Contents                                                                      |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [`phase-1.ai-exec.index.md`](phase-1.ai-exec.index.md)                     | `document_meta`, AGENT_START_SEQUENCE, module map, doc drift, fail conditions |
| [`phase-1-overview.md`](phase-1-overview.md)                               | Phase detection · §1–§3 · anti-patterns A1–A10                                |
| [`phase-1-state-machine.md`](phase-1-state-machine.md)                     | State model · DAG                                                             |
| [`phase-1-enforcement.md`](phase-1-enforcement.md)                         | Forbidden · DoD · Phase 2 entry · completion                                  |
| [`phase-1-guards.md`](phase-1-guards.md)                                   | `g1`–`g13` checks (`phase-1-guard.mjs`)                                       |
| [`phase-1-ci.md`](phase-1-ci.md)                                           | `phase-1:gate` chain                                                          |
| [`subphases/1.1-scaffold.md`](subphases/1.1-scaffold.md)                   | §4.1                                                                          |
| [`subphases/1.2-field-registry.md`](subphases/1.2-field-registry.md)       | §4.2                                                                          |
| [`subphases/1.3-rule-engine.md`](subphases/1.3-rule-engine.md)             | §4.3                                                                          |
| [`subphases/1.4-render-plan-steps.md`](subphases/1.4-render-plan-steps.md) | §4.4                                                                          |
| [`subphases/1.5-renderer-headless.md`](subphases/1.5-renderer-headless.md) | §4.5                                                                          |
| [`subphases/1.6-guardrails-facade.md`](subphases/1.6-guardrails-facade.md) | §4.6                                                                          |
| [`audits/forensic-template.md`](audits/forensic-template.md)               | §9.4 forensic truth                                                           |
| [`audits/closure-contracts.md`](audits/closure-contracts.md)               | 14 closure contract rows                                                      |
| [`audits/verification-matrix.md`](audits/verification-matrix.md)           | `g*` ↔ P1-E-\* map                                                            |
| [`appendices/`](appendices/)                                               | API surface · test matrix · commands · PR template                            |

## Cross-phase continuity

`PlatformWizardEngine` / `validateCanonical` are consumed at Phase 5.2 — do not bypass. Hub: [`../appendices/PLATFORM-CONTINUITY-0-5.md`](../appendices/PLATFORM-CONTINUITY-0-5.md)

## Agent load order

1. [`phase-1.ai-exec.index.md`](phase-1.ai-exec.index.md)
2. [`phase-1-state-machine.md`](phase-1-state-machine.md)
3. [`phase-1-guards.md`](phase-1-guards.md) + [`phase-1-enforcement.md`](phase-1-enforcement.md)
4. Active [`subphases/`](subphases/) file
5. [`phase-1-ci.md`](phase-1-ci.md) before merge / 1.6

**Rule:** `pnpm run phase-1:gate` per `package.json` — includes `test:phase-1` (DRIFT-01).

## Validation

- [`QUALITY-VALIDATION.md`](QUALITY-VALIDATION.md) — Phase 1 quality pass
- [`../phases/DOCUMENTATION-CURATION-VALIDATION.md`](../phases/DOCUMENTATION-CURATION-VALIDATION.md) — cross-phase curation
