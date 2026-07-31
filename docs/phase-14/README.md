# Phase 14 — Wizard enterprise plugin closure (83 → 95+)

> **Status:** DONE — 2026-06-18  
> **Prerequisite:** Phase 13 DONE  
> **Roadmap:** `temp/wizard_plugin_plan.md` (historical local scratch `wizard_plugin_plan.md`; not fresh-clone authority — see docs/audits/snapshots/2026-07-31/psr-2b-temp-authority-inventory.yaml)

## Goal

Decouple generic wizard layers from Denali via manifest codegen registries, SDK hooks (`mergeDraftEnvelope`, `normalizeWizardTemplateGate`), clone/remint dispatch, and a shared create orchestrator with Starter/Urban proof.

## Subphases

| ID | Doc | Status |
|----|-----|--------|
| 14.0 | [surface-registry-codegen](subphases/14.0-surface-registry-codegen.md) | **DONE** |
| 14.0b | [label-resolver-manifest](subphases/14.0b-label-resolver-manifest.md) | **DONE** |
| 14.0b | [template-gate-hooks](subphases/14.0b-template-gate-hooks.md) | **DONE** |
| 14.1 | [clone-remint-manifest](subphases/14.1-clone-remint-manifest.md) | **DONE** |
| 14.2 | [merge-envelope-hook](subphases/14.2-merge-envelope-hook.md) | **DONE** |
| 14.3 | [generic-create-orchestrator](subphases/14.3-generic-create-orchestrator.md) | **DONE** |
| 14.3 | [starter-create-parity](subphases/14.3-starter-create-parity.md) | **DONE** |
| 14.4 | [urban-proof-tck-closure](subphases/14.4-urban-proof-tck-closure.md) | **DONE** |

## Gaps closed

- GAP-01 composite registry static Denali map
- GAP-04 review registry static import
- GAP-02/03 label resolver decoupling
- GAP-05/06 template gate Denali imports
- GAP-07–09 clone remint dispatch
- GAP-10/11 mergeDraftEnvelope SDK hook
- GAP-12–14 generic create orchestrator
- GAP-15 Urban manifest wizard i18n + TCK proof

## Scorecard (target ≥95)

| Dimension | After Phase 14 |
|-----------|----------------|
| Core/SDK neutrality | 18 |
| API manifest dispatch | 13 |
| Web registries + labels + gate | 21 |
| Create orchestrator | 17 |
| Draft envelope + merge | 11 |
| TCK + machine gates | 10 |
| BFF neutrality | 5 |
| **Total** | **~95** |

## Verification

```bash
pnpm run phase-14:wizard-gate
```

Architect, documentation status: Updated. Link to docs: docs/phase-14/README.md
