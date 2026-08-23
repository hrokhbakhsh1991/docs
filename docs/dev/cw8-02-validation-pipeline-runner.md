# CW8-02 — Validation pipeline runner (implementation)

**Verdict:** Implementation  
**Ledger task:** CW8-02  
**Status:** Host runner behind `WORKSPACE_VALIDATION_PIPELINE=1`  
**Prepared:** 2026-08-23  
**Design contract:** [`cw8-01-validation-pipeline-contract.md`](cw8-01-validation-pipeline-contract.md)

---

## 1. Scope

Infrastructure-only strangler pattern:

| Path | Behavior |
|------|----------|
| Default (`WORKSPACE_VALIDATION_PIPELINE` unset / `0`) | Legacy flat sequence in `validateCanonicalDocumentWithEngine` — unchanged |
| Opt-in (`WORKSPACE_VALIDATION_PIPELINE=1`) | `runWorkspaceValidationPipeline` — three ordered stages |

**Out of scope (CW8-03+):** Denali/Urban workspace migration (CW8-04/05), legacy flat-hook removal (CW8-06).

**CW8-03:** manifest `workspacePolicy` module wired via `workspace-policy-validation-bindings.generated.ts` — see [`cw8-03-workspace-policy-seam.md`](cw8-03-workspace-policy-seam.md).

---

## 2. Files

| File | Role |
|------|------|
| `packages/workspace-sdk/src/plugin/workspace-validation-pipeline.ts` | `WorkspaceValidationPipelineContext`, stage types, `ValidationMode` |
| `apps/api/src/tours/run-workspace-validation-pipeline.ts` | Stage runners + `runWorkspaceValidationPipeline` |
| `apps/api/src/tours/workspace-capability-validation-bindings.generated.ts` | Empty binding stub until codegen domain lands |
| `apps/api/src/tours/is-workspace-validation-pipeline-enabled.ts` | `WORKSPACE_VALIDATION_PIPELINE=1` gate |
| `apps/api/src/tours/canonical-validation-sync.ts` | Flag branch — legacy vs pipeline |

---

## 3. Stage implementation

### 3.1 `sharedValidation`

1. `engine.validateCanonical(document, { tenantId, dimensions })`
2. Optional `plugin.wizardHost.filterEngineValidationResult`
3. First engine violation → pipeline surface; throw uses **joined messages** (legacy parity — no `code:` prefix)

### 3.2 `capabilityValidation`

1. Iterate `WORKSPACE_CAPABILITY_VALIDATORS` (empty stub — skip, no error)
2. When `validationMode === "publish"` and `catalogRefAllowlists` present: `assertCatalogRefIntegrity`

Publish lifecycle gate (`assertCanonicalTourWritePublishGate`) remains **outside** the pipeline on write paths per CW8-01 §3.1.

### 3.3 `workspacePolicyValidation`

1. `runWorkspaceValidationHooks` — registry extract + `checkCapacity` / `checkTripDetails`
2. When `validationMode === "publish"`: `runValidationModePublishGate` (`validatePublishReadiness`)
3. Manifest `workspacePolicy` module via `resolveWorkspacePolicyValidator` (CW8-03)

---

## 4. Semantics

- Fixed order: shared → capability → policy
- Short-circuit on first `WorkspaceViolation`
- Sync-only stages
- `draft` mode skips `validatePublishReadiness`
- No workspace ID / workspaceType branches in generic runner

---

## 5. Tests

| Spec | Coverage |
|------|----------|
| `run-workspace-validation-pipeline.spec.ts` | Order, short-circuit, empty capability stage |
| `cw8-02-flag-parity.spec.ts` | Flag off/on parity (starter, Denali, Urban fixtures) |

---

## 6. Flag

```bash
WORKSPACE_VALIDATION_PIPELINE=1  # dev/CI opt-in until CW8-06
```

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw8-02-validation-pipeline-runner.md`.*
