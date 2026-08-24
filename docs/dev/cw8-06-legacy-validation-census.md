# CW8-06 — Legacy flat validation-hook consumer census

**Verdict:** Implementation  
**Ledger task:** CW8-06  
**Status:** Legacy persist branch retired; pipeline is sole production path  
**Prepared:** 2026-08-24

---

## Census method

Static search across `/workspace` for:

- `runWorkspaceValidationHooks`
- `plugin.validation.checkCapacity` / `checkTripDetails` as primary persist path
- Legacy branch in `canonical-validation-sync.ts` when pipeline flag off
- `runValidationModePublishGate` separate from pipeline

Each reference classified below. **Zero production consumers** of the legacy flat persist branch were found after CW8-04/05 proved Denali/Urban policy-module parity.

---

## `runWorkspaceValidationHooks`

| Location | Classification | Retain / Remove |
| -------- | -------------- | --------------- |
| `apps/api/src/tours/canonical-validation-sync.ts` (legacy branch) | ZERO_CONSUMER_SAFE_TO_REMOVE | **Removed** CW8-06 |
| `apps/api/src/tours/run-workspace-validation-pipeline.ts` (`runWorkspacePolicyValidationStage`) | PRODUCTION_CONSUMER | **Retained** — starter / policy-cert / profile-cert without `supersedesFlatHooks` |
| `apps/api/src/tours/run-workspace-validation-pipeline.ts` (`runLegacyPostEngineValidation`) | COMPAT_TEST_ONLY | **Retained** — isolates post-engine segments in `run-workspace-validation-pipeline.spec.ts` |
| `apps/api/src/tours/run-workspace-validation-hooks.ts` | PRODUCTION_CONSUMER | **Retained** — implementation for pipeline flat-hook substage |
| `apps/api/src/tours/run-workspace-validation-hooks.spec.ts` | COMPAT_TEST_ONLY | **Retained** — registry extraction unit tests |
| `docs/**`, `docs/phase-*` | REEXPORT_ONLY / docs | No runtime effect |

---

## `plugin.validation.checkCapacity` / `checkTripDetails` as primary persist path

| Location | Classification | Retain / Remove |
| -------- | -------------- | --------------- |
| `run-workspace-validation-hooks.ts` | PRODUCTION_CONSUMER | **Retained** — invoked via pipeline for non-superseding workspaces |
| `packages/workspaces/denali/src/policy/tour-policy.ts` | PRODUCTION_CONSUMER | **Retained** — Denali policy module (supersedes flat host hooks) |
| `packages/workspaces/urban/src/policy/tour-policy.ts` | PRODUCTION_CONSUMER | **Retained** — Urban policy module |
| `packages/workspaces/urban/src/internal.ts` | EXTERNAL_PUBLIC_COMPAT | **Retained** — plugin hook surface; noop at Denali plugin re-export |
| `packages/workspaces/denali/src/denali.plugin.ts` | EXTERNAL_PUBLIC_COMPAT | **Retained** — noop hooks; real rules in policy module |
| Workspace package unit tests | COMPAT_TEST_ONLY | **Retained** |

**Decision:** Denali/Urban production persist no longer calls host flat hooks directly — policy modules with `supersedesFlatHooks: true` own the path (CW8-04/05 parity). Starter and cert workspaces still use `runWorkspaceValidationHooks` inside pipeline stage 3.

---

## Legacy branch in `canonical-validation-sync.ts` (pipeline flag off)

| Location | Classification | Retain / Remove |
| -------- | -------------- | --------------- |
| `validateCanonicalDocumentWithEngine` `if (!isWorkspaceValidationPipelineEnabled())` block | ZERO_CONSUMER_SAFE_TO_REMOVE | **Removed** CW8-06 |
| Inline `engine.validateCanonical` + flat hooks + publish gate + catalog assert | ZERO_CONSUMER_SAFE_TO_REMOVE | **Removed** — superseded by `runWorkspaceValidationPipeline` stages |

**Decision:** `validateCanonicalDocumentWithEngine` always calls `runWorkspaceValidationPipeline`. No env flag required for production.

---

## `runValidationModePublishGate` separate from pipeline

| Location | Classification | Retain / Remove |
| -------- | -------------- | --------------- |
| `canonical-validation-sync.ts` legacy branch | ZERO_CONSUMER_SAFE_TO_REMOVE | **Removed** CW8-06 |
| `run-workspace-validation-pipeline.ts` (`runWorkspacePolicyValidationStage`) | PRODUCTION_CONSUMER | **Retained** — starter publish readiness |
| `resolve-validation-mode.ts` (definition) | PRODUCTION_CONSUMER | **Retained** |
| `test/parity/wizard-frozen.golden.spec.mjs` | COMPAT_TEST_ONLY | **Retained** — parity harness |
| `apps/api/test/canonical-validation-draft-vs-publish.spec.ts` | COMPAT_TEST_ONLY | **Retained** |
| `apps/api/test/workspace-metadata-denali-parity-publish.spec.ts` | COMPAT_TEST_ONLY | **Retained** |
| `apps/api/test/denali-metadata-path-publish-integration.spec.ts` | COMPAT_TEST_ONLY | **Retained** |
| `docs/**` | REEXPORT_ONLY | No runtime effect |

---

## Retired env flags

| Env | CW8-06 action |
| --- | ------------- |
| `WORKSPACE_VALIDATION_PIPELINE` | No longer required (`=1` was opt-in). File `is-workspace-validation-pipeline-enabled.ts` retained for rollback metadata only (`=0` documents intent; legacy branch removed). |
| `WORKSPACE_VALIDATION_PIPELINE_DENALI_POLICY` | **Removed** — Denali policy supersedes flat hooks whenever `supersedesFlatHooks: true` |
| `WORKSPACE_VALIDATION_PIPELINE_URBAN_POLICY` | **Removed** — Urban policy supersedes flat hooks whenever `supersedesFlatHooks: true` |

---

## Invariants preserved

| Invariant | Evidence |
| --------- | -------- |
| Denali validation unchanged | `cw8-04-denali-pipeline-parity.spec.ts` |
| Urban validation unchanged | `cw8-05-urban-pipeline-parity.spec.ts` |
| Pipeline ordering | `run-workspace-validation-pipeline.spec.ts` |
| Workspace policy seam | `workspace-policy-module.spec.ts` |
| No workspace-ID branching in host | policy bindings codegen-only |
| Failure aggregation (first violation short-circuit) | pipeline stage loop unchanged |

---

## Tests

| Spec | Role |
| ---- | ---- |
| `cw8-06-consumer-census.spec.ts` | Asserts legacy branch absent; census doc present |
| `cw8-04-denali-pipeline-parity.spec.ts` | Denali golden regression |
| `cw8-05-urban-pipeline-parity.spec.ts` | Urban golden regression |
| `cw8-02-flag-parity.spec.ts` | Pipeline regression (legacy comparison retired) |
| `run-workspace-validation-pipeline.spec.ts` | Stage order + legacy post-engine helper |
| `workspace-policy-module.spec.ts` | Policy seam |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw8-06-legacy-validation-census.md`.*
