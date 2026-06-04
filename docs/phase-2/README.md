# Phase 2 — AI execution documentation hub

Modular **AI-execution** spec. Narrative: [`../phase-2-design-system.md`](../phase-2-design-system.md) · Markdoc: [`../phase-2-design-system.mdoc`](../phase-2-design-system.mdoc).

## Canonical entrypoint

- **Central index (agents):** [`../phase-2-design-system.ai-exec.md`](../phase-2-design-system.ai-exec.md)
- **Detailed modules:** [`phase-2.ai-exec.index.md`](phase-2.ai-exec.index.md)

## Navigation

| File | Contents |
|------|----------|
| [`phase-2.ai-exec.index.md`](phase-2.ai-exec.index.md) | `document_meta`, agent algorithm, module map, doc drift, fail conditions |
| [`phase-2-overview.md`](phase-2-overview.md) | Phase detection · §1–§5 |
| [`phase-2-state-machine.md`](phase-2-state-machine.md) | State model · DAG · PR rules |
| [`phase-2-enforcement.md`](phase-2-enforcement.md) | Forbidden · DoD · Phase 3 entry · completion checklist |
| [`phase-2-guards.md`](phase-2-guards.md) | All `p2_*` checks (`phase-2-guard.mjs`) |
| [`phase-2-ci.md`](phase-2-ci.md) | `phase-2:gate` chain · Appendix G repo truth |
| [`subphases/2.1-design-tokens.md`](subphases/2.1-design-tokens.md) | §7 |
| [`subphases/2.2-workspace-theme-contract.md`](subphases/2.2-workspace-theme-contract.md) | §8 |
| [`subphases/2.2.1-theme-ingress-security.md`](subphases/2.2.1-theme-ingress-security.md) | §8.2.1 · T-1–T-7 |
| [`subphases/2.3-ui-primitives.md`](subphases/2.3-ui-primitives.md) | §9 |
| [`subphases/2.4-theme-react.md`](subphases/2.4-theme-react.md) | §10 |
| [`subphases/2.5-visual-qa-gate.md`](subphases/2.5-visual-qa-gate.md) | §11 |
| [`audits/forensic-template.md`](audits/forensic-template.md) | SB-01/02/03 forensic truth |
| [`audits/verification-matrix.md`](audits/verification-matrix.md) | Test matrix binding · `p2_*` map |
| [`appendices/`](appendices/) | Dependency graph · commands · PR template · MAP bridge |

## Agent load order

1. [`phase-2.ai-exec.index.md`](phase-2.ai-exec.index.md)
2. [`phase-2-state-machine.md`](phase-2-state-machine.md)
3. [`phase-2-guards.md`](phase-2-guards.md) + [`phase-2-enforcement.md`](phase-2-enforcement.md)
4. Active [`subphases/`](subphases/) file
5. [`phase-2-ci.md`](phase-2-ci.md) before merge / 2.5

**Rule:** `pnpm run phase-2:gate` per `package.json` — not stale mdoc Appendix G JSON alone.

## Validation

- [`QUALITY-VALIDATION.md`](QUALITY-VALIDATION.md) — Phase 2 quality pass
- [`../phases/DOCUMENTATION-CURATION-VALIDATION.md`](../phases/DOCUMENTATION-CURATION-VALIDATION.md) — cross-phase curation
