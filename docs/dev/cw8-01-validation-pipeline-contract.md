# CW8-01 — Workspace validation pipeline contract (design)

**Verdict:** **PASS**  
**Ledger task:** CW8-01  
**Status:** Design contract frozen — **no host runner** (CW8-02+)  
**Prepared:** 2026-08-23 (Wave 6A)  
**Deps satisfied:** CW5-11  

**Mandatory inputs (not re-audited):**

- `docs/dev/composable-workspace-refactor-plan.md` — CW-8 phase, CW8-03 policy seam, CW6-05B join
- `.architecture-analysis/COMPOSABLE-WORKSPACE-ARCHITECTURE-AUDIT.md` (AUDIT) §7 missing seam
- `.architecture-analysis/SHARED-TOUR-CORE-EXTRACTION-FEASIBILITY.md` (FEAS) §2.2
- `packages/workspace-sdk/src/plugin/workspace-validation.ts` — flat hooks today
- `apps/api/src/tours/run-workspace-validation-hooks.ts` — API runner
- `apps/api/src/tours/resolve-validation-mode.ts` — publish gate

---

## 1. Executive summary

Replace the implicit flat hook bag with an **ordered three-stage pipeline**:

```text
sharedValidation → capabilityValidation → workspacePolicyValidation
```

**Semantics:** fixed order; **short-circuit on first violation**; Denali/Urban behavior preserved when stages map 1:1 to today's call sites. CW8-02 implements behind flag; legacy path remains default until CW8-06.

CW8-03 adds **manifest-declared workspace policy module** — CW6-05B proof depends on this seam.

---

## 2. Pipeline stages (binding definitions)

### 2.1 `sharedValidation`

**Purpose:** platform-neutral structural validation before workspace semantics.

| Step | Current implementation | Owner |
|------|------------------------|-------|
| Canonical field / exposure validation | `PlatformWizardEngine.validateCanonical` / `validateCanonical` sync paths | `platform-core` + workspace field registry |
| Registry-driven value extraction | `extractCapacity`, `extractTripDetails`, `extractTransportModes` in `run-workspace-validation-hooks.ts` | API host (moves to shared runner) |
| Structural type guards | finite number capacity, object tripDetails shape | shared runner |

**Does not include:** Urban capacity range policy, Denali publish matrix, transport dong rules.

**Output:** `PipelineViolation | null` — first failure stops pipeline.

### 2.2 `capabilityValidation`

**Purpose:** rules bound to **enabled manifest capabilities** and **tour-core ports** — workspace-type dispatch without host `if (workspaceType)`.

| Source today | Mapped stage | Notes |
|--------------|--------------|-------|
| `assertCanonicalTourWritePublishGate` / publish lifecycle | capability when `workspaceBooking` or publish port bound | tour-core neutral gate |
| Capacity strategy ports (`atCreate` vs operator approval) | capability when registration model bound | DEC-CW-01/03 |
| Equipment field module checks (CW7-03) | capability when `workspaceEquipment.supported` | id ∈ tenant catalog |
| Transport initializer snapshot (CW7-06) | capability when `workspaceTransport` | generic snapshot only |
| Archive semantics | capability optional per DEC-CW-02 | not generic enum |

**Dispatch:** generated `workspace-capability-validation-bindings.generated.ts` from manifest blocks (coordinator CW8-02).

**Does not include:** Denali `collectDenaliPublishReadinessRuleIssues` matrix; Urban forbidden itinerary policy.

### 2.3 `workspacePolicyValidation`

**Purpose:** workspace-specific product rules and optional custom policy modules.

| Source today | Mapped stage |
|--------------|--------------|
| `plugin.validation.checkCapacity` | workspace policy (Urban range rules) |
| `plugin.validation.checkTripDetails` | workspace policy (Urban forbidden transport/itinerary) |
| `plugin.wizardHost.validatePublishReadiness` | workspace policy (Denali publish matrix) |
| Future `workspacePolicy` manifest module (CW8-03) | workspace policy |

**CW8-03 seam (preview):**

```json
"workspacePolicy": {
  "module": "./policy/tour-policy",
  "export": "createTourWorkspacePolicyValidator"
}
```

Factory returns hooks conforming to `WorkspacePolicyValidator` (new SDK type) — additive rules only; cannot skip shared/capability stages.

---

## 3. Short-circuit and ordering semantics

```text
function runWorkspaceValidationPipeline(ctx): WorkspaceViolation | null {
  const v1 = runSharedValidation(ctx);
  if (v1) return v1;
  const v2 = runCapabilityValidation(ctx);
  if (v2) return v2;
  return runWorkspacePolicyValidation(ctx);
}
```

| Property | Rule |
|----------|------|
| Order | Always shared → capability → policy |
| Short-circuit | Return first non-null violation |
| Aggregation | **No** multi-violation collect in v1 pipeline (host may wrap for UI) |
| `validationMode` | `draft` skips publish-only policy substeps (see §4) |
| Mode `publish` | all substeps that apply to mode run in order |

---

## 4. Validation mode interaction

Today `resolveValidationMode` + `runValidationModePublishGate` gate publish-readiness separately.

**Pipeline binding:**

| Mode | sharedValidation | capabilityValidation | workspacePolicyValidation |
|------|------------------|----------------------|---------------------------|
| `draft` | full | capability draft hooks | policy draft hooks; **skip** `validatePublishReadiness` |
| `publish` | full | full + publish lifecycle gates | full + `validatePublishReadiness` + policy publish hooks |

`runValidationModePublishGate` merges into **workspacePolicyValidation** publish branch (CW8-02), not a fourth stage — preserves single policy stage for product rules.

---

## 5. Type contract (SDK, CW8-02)

```ts
export type WorkspaceValidationPipelineContext = {
  readonly plugin: WorkspacePlugin;
  readonly document: CanonicalDocument;
  readonly workspaceType: string;
  readonly validationMode: ValidationMode;
  readonly rulesModule?: unknown;
};

export type WorkspaceValidationPipelineStage = (
  ctx: WorkspaceValidationPipelineContext,
) => WorkspaceViolation | null;

export type WorkspaceValidationPipeline = {
  readonly sharedValidation: WorkspaceValidationPipelineStage;
  readonly capabilityValidation: WorkspaceValidationPipelineStage;
  readonly workspacePolicyValidation: WorkspaceValidationPipelineStage;
};
```

**Flat hook compatibility:** `WorkspaceValidationHooks` remains; policy stage invokes hooks until CW8-06 retires flat path.

---

## 6. Mapping table — Denali vs Urban (parity witness)

| Check | Denali today | Stage |
|-------|--------------|-------|
| `validateCanonical` | platform-core | sharedValidation |
| Publish lifecycle gate (API write) | tour-core via dispatch | capabilityValidation |
| `checkCapacity` noop | returns null | workspacePolicyValidation (noop) |
| `checkTripDetails` noop | returns null | workspacePolicyValidation (noop) |
| `validatePublishReadiness` | Denali matrix | workspacePolicyValidation (publish only) |

| Check | Urban today | Stage |
|-------|-------------|-------|
| `validateCanonical` | platform-core | sharedValidation |
| `checkCapacity` 1..50000 | Urban hook | workspacePolicyValidation |
| `checkTripDetails` forbidden transport/itinerary | Urban hook | workspacePolicyValidation |
| `validatePublishReadiness` | absent / noop | skipped |

**CW8-04/05 migrations:** golden parity via CW0-07 publish goldens + existing API specs; order change must not alter first violation code/message.

---

## 7. Host runner (CW8-02 sketch)

| File | Role |
|------|------|
| `apps/api/src/tours/run-workspace-validation-pipeline.ts` | successor to `run-workspace-validation-hooks.ts` |
| `apps/api/src/tours/run-workspace-validation-hooks.ts` | legacy wrapper calling pipeline or flat path via env flag |
| Flag | `WORKSPACE_VALIDATION_PIPELINE=1` (dev/CI opt-in until CW8-06) |

Call graph insertion point (unchanged outer contract):

```text
validateBeforePersist → validateCanonical → runWorkspaceValidation* → persist
```

---

## 8. CW6-05B / CW8-03 join

CW6-05B requires a synthetic profile workspace to add **two custom policy rules** via manifest only:

1. CW6-04 scaffold workspace with `profile: "starter-outdoor"`
2. CW8-03 `workspacePolicy` module exporting validator factory
3. CW6-05B cert: rules fire in **workspacePolicyValidation** after capability stage; zero host edits

Profile expansion must copy `workspacePolicy` block from author manifest (author wins); profile catalog must not embed workspace-specific policy modules.

---

## 9. Guardrails (CW8-07 preview)

- Pipeline order certification spec (stage mock ordering)
- Policy modules cannot import `apps/*` or `packages/workspaces/denali` product ids (extend coupling guard)
- Lint: policy modules must not call `validateCanonical` directly (shared stage only)

---

## 10. Tests required (CW8-02+)

| Test | Scope |
|------|-------|
| `run-workspace-validation-pipeline.spec.ts` | order + short-circuit |
| `run-workspace-validation-hooks.spec.ts` | legacy parity (existing, extend) |
| `cw8-02-flag-parity.spec.ts` | flag on/off identical violations Denali/Urban fixtures |
| `cw8-04-denali-pipeline-parity.spec.ts` | CW0-07 goldens |
| `cw8-07-pipeline-order-cert.spec.ts` | certification |
| `workspace-policy-module.spec.ts` | CW8-03 synthetic two-rule workspace |

---

## 11. Shared files future implementation MUST touch

| File | Change |
|------|--------|
| `packages/workspace-sdk/src/plugin/workspace-validation-pipeline.ts` | **New** types |
| `packages/workspace-sdk/src/plugin/workspace-validation.ts` | Policy validator type (CW8-03) |
| `packages/workspace-sdk/src/public-api.ts` | Exports (coordinator) |
| `apps/api/src/tours/run-workspace-validation-pipeline.ts` | **New** runner |
| `apps/api/src/tours/run-workspace-validation-hooks.ts` | Legacy delegate |
| `apps/api/src/tours/resolve-validation-mode.ts` | Merge publish gate into policy stage |
| `scripts/codegen/workspace-registry/domains/validation-pipeline.mjs` | Capability bindings |
| `packages/workspaces/denali/src/wizard/denali-wizard-host-hooks.ts` | CW8-04 migration |
| `packages/workspaces/urban/src/internal.ts` | CW8-05 migration |

---

## 12. CW8-01 closure checklist

| Item | Status |
|------|--------|
| Three stages defined | ✅ |
| Short-circuit semantics | ✅ first violation |
| Flat hooks mapped | ✅ policy stage |
| `validatePublishReadiness` mapped | ✅ policy publish branch |
| Denali/Urban parity plan | ✅ mapping table |
| CW8-03 seam preview | ✅ `workspacePolicy` block |
| CW6-05B join documented | ✅ |
| Implementation deferred | ✅ CW8-02+ |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw8-01-validation-pipeline-contract.md`.*
