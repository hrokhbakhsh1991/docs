# Phase 3 — AI execution documentation hub

Modular **AI-execution** spec. Narrative: [`../phase-3-design-system.md`](../phase-3-design-system.md) · Markdoc: [`../phase-3-design-system.mdoc`](../phase-3-design-system.mdoc).

## Canonical entrypoint

- **Central index (agents):** [`../phase-3-design-system.ai-exec.md`](../phase-3-design-system.ai-exec.md)
- **Detailed modules:** [`phase-3.ai-exec.index.md`](phase-3.ai-exec.index.md)

## Navigation

| File | Contents |
|------|----------|
| [`phase-3.ai-exec.index.md`](phase-3.ai-exec.index.md) | `document_meta`, AGENT_START_SEQUENCE, module map, doc drift, fail conditions |
| [`phase-3-overview.md`](phase-3-overview.md) | Phase detection · §1–§6 |
| [`phase-3-state-machine.md`](phase-3-state-machine.md) | State model · DAG · PR rules |
| [`phase-3-enforcement.md`](phase-3-enforcement.md) | P3-E-* · Forbidden · DoD · Phase 4 entry · completion |
| [`phase-3-guards.md`](phase-3-guards.md) | All `p3_*` checks (`phase-3-guard.mjs`) |
| [`phase-3-ci.md`](phase-3-ci.md) | `phase-3:gate` chain · Appendix G repo truth |
| [`subphases/3.0-casl-authority.md`](subphases/3.0-casl-authority.md) | §8 |
| [`subphases/3.1-workspace-starter.md`](subphases/3.1-workspace-starter.md) | §9 |
| [`subphases/3.2-apps-api.md`](subphases/3.2-apps-api.md) | §10 |
| [`subphases/3.3-apps-web.md`](subphases/3.3-apps-web.md) | §11 |
| [`subphases/3.3.x-select-checkbox.md`](subphases/3.3.x-select-checkbox.md) | Optional Select/Checkbox |
| [`subphases/3.4-canonical-sot.md`](subphases/3.4-canonical-sot.md) | §12 canonical |
| [`subphases/3.5-observability-gate.md`](subphases/3.5-observability-gate.md) | §12 gate closure |
| [`audits/forensic-template.md`](audits/forensic-template.md) | Phase 2 lessons forensic |
| [`audits/verification-matrix.md`](audits/verification-matrix.md) | `p3_*` ↔ P3-E-* map |
| [`appendices/`](appendices/) | Dependency graph · commands · PR template · test matrix |

## Agent load order

1. [`phase-3.ai-exec.index.md`](phase-3.ai-exec.index.md)
2. [`phase-3-state-machine.md`](phase-3-state-machine.md)
3. [`phase-3-guards.md`](phase-3-guards.md) + [`phase-3-enforcement.md`](phase-3-enforcement.md)
4. Active [`subphases/`](subphases/) file
5. [`phase-3-ci.md`](phase-3-ci.md) before merge / 3.5

**Rule:** `pnpm run phase-3:gate` per `package.json` — not stale mdoc §13.4 JSON alone.

## Validation

- [`QUALITY-VALIDATION.md`](QUALITY-VALIDATION.md) — Phase 3 quality pass
- [`../phases/DOCUMENTATION-CURATION-VALIDATION.md`](../phases/DOCUMENTATION-CURATION-VALIDATION.md) — cross-phase curation
