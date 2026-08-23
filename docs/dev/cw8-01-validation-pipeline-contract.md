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

**Semantics:** fixed order; **short-circuit on first violation** (inter- and intra-stage); sync-only stages; workspace-specific rules **only** through policy seam (§4). Denali/Urban behavior preserved when stages map 1:1 to today's call sites. CW8-02 implements behind flag; legacy path remains default until CW8-06.

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

## 3. Pipeline semantics (binding)

### 3.1 Stage order (fixed)

```text
sharedValidation → capabilityValidation → workspacePolicyValidation
```

Outer persist contract (unchanged):

```text
validateBeforePersist
  → assertCanonicalDocument
  → sharedValidation          (validateCanonical + filterEngineValidationResult)
  → capabilityValidation      (publish lifecycle, catalog refs, capability ports)
  → workspacePolicyValidation (flat hooks + validatePublishReadiness)
  → persist
```

`assertCanonicalTourWritePublishGate` (CW5-07 write path) remains **outside** this pipeline — it gates lifecycle transitions on update, not pre-persist canonical shape.

### 3.2 Short-circuit

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
| Inter-stage | Return first non-null `WorkspaceViolation`; later stages **never run** |
| Intra-stage | Each stage returns first violation from its ordered substeps (see §3.3) |
| Stage success | `null` — pipeline continues |

### 3.3 Deterministic ordering

**Between stages:** manifest-independent — always shared → capability → policy.

**Within `sharedValidation`:**

| Substep order | Source | Tie-break |
|---------------|--------|-----------|
| 1. `engine.validateCanonical` | `PlatformWizardEngine` | platform-core violation order (field registry declaration order) |
| 2. `filterEngineValidationResult` | `plugin.wizardHost` (optional) | workspace-owned filter; Denali only today |

**Within `capabilityValidation` (CW8-02 codegen):**

| Substep order | Rule |
|---------------|------|
| Capability validators | **Manifest declaration order** in `workspace.manifest.json` `capabilities` block (stable JSON key sort at codegen time — same rule as CW7-02 equipment bindings) |
| Publish lifecycle gate | After all enabled capability validators when `validationMode === "publish"` |
| `assertCatalogRefIntegrity` | Last capability substep when `validationMode === "publish"` and `catalogRefAllowlists` present |

**Within `workspacePolicyValidation`:**

| Substep order | Source today | Rule |
|---------------|--------------|------|
| 1. `checkCapacity` | `run-workspace-validation-hooks.ts` | Runs when registry exposes capacity field; first matching capacity field wins |
| 2. `checkTripDetails` | same | Runs when tripDetails extracted; capacity must pass first |
| 3. `validatePublishReadiness` | `resolve-validation-mode.ts` | Publish mode only; first matrix violation wins |
| 4. `workspacePolicy` module (CW8-03) | manifest factory | After flat hooks; ordered rules from factory |

CW8-02 must preserve **identical first-violation** for Denali/Urban when substeps map 1:1 — golden parity (CW0-07, CW8-04/05).

### 3.4 Error aggregation

| Layer | Aggregation today | Pipeline rule |
|-------|-------------------|---------------|
| `validateCanonical` | Collects **all** violations into `ValidationResult.violations`; host throws joined message | **sharedValidation** may collect internally; pipeline surface returns **first** violation only |
| `filterEngineValidationResult` | May shrink violation list (Denali composite parity) | Runs inside sharedValidation; if result not ok, return **first** remaining violation |
| `runWorkspaceValidationHooks` | First hook violation only | Maps to policy substeps 1–2 |
| `validatePublishReadiness` | Returns `violations[]`; `runValidationModePublishGate` takes **`violations[0]`** only | Policy substep 3 — first violation only |
| Pipeline host | `throwValidationFailure(\`CANONICAL_VALIDATION_FAILED: ${code}: ${message}\`)` | Single violation per persist attempt |

**v1 pipeline:** no multi-violation API. UI/wizard hosts that need lists (`validateDraftSync`, step validation) remain **outside** this persist pipeline — they may aggregate; persist path stays short-circuit.

### 3.5 Sync / async expectations

| Concern | Contract |
|---------|----------|
| Pipeline stages | **Sync only** — `WorkspaceValidationPipelineStage` returns `WorkspaceViolation \| null` synchronously |
| `validateBeforePersist` | Async wrapper (`validateCanonicalBeforePersistAsync`) for plugin/engine resolution only; pipeline body sync |
| `wizardHost.ensureReady` | Async warm-up — **not** part of validation pipeline |
| `loadRulesModule` | Async in wizard UI — publish gate uses **sync** `getWizardRulesModuleSyncForWorkspace` binding |
| CW8-03 policy module | Factory is sync; async policy rules **deferred** until a future CW task explicitly extends the contract |

### 3.6 Absence behavior

| Missing seam | Behavior |
|--------------|----------|
| Capability not in manifest | Skip that capability validator — **no error** |
| `workspacePolicy` module absent (CW8-03) | Fall back to flat `WorkspaceValidationHooks` + optional `validatePublishReadiness` |
| `validatePublishReadiness` absent | Skip publish matrix — return `null` (Urban today) |
| `filterEngineValidationResult` absent | Pass through `validateCanonical` result unchanged |
| `checkCapacity` / `checkTripDetails` noop | Return `null` — Denali today |
| No capacity/tripDetails in document | Skip respective hook — no invocation |
| `getWizardRulesModuleSyncForWorkspace` throws | Publish gate returns `null` (fail-open today — CW8-04 may tighten) |
| `catalogRefAllowlists` absent in publish mode | Skip `assertCatalogRefIntegrity` |

### 3.7 Failure behavior

| Failure kind | Outcome |
|--------------|---------|
| Pipeline violation | `throwValidationFailure` with prefix `CANONICAL_VALIDATION_FAILED:` and `code: message` |
| `assertCanonicalDocument` / schema version mismatch | Throw before pipeline stages |
| Engine init failure | Mapped via `validationResultFromPlatformError` inside sharedValidation |
| Uncaught throw from stage | Propagate — stages must not swallow errors |
| Write-path publish gate (`assertCanonicalTourWritePublishGate`) | Separate throw path on tour update — not folded into pipeline |

### 3.8 `validationMode` interaction

| Mode | sharedValidation | capabilityValidation | workspacePolicyValidation |
|------|------------------|----------------------|---------------------------|
| `draft` | full | capability draft hooks | policy draft hooks; **skip** `validatePublishReadiness` |
| `publish` | full | full + publish lifecycle + catalog refs | full + `validatePublishReadiness` + policy publish hooks |

`runValidationModePublishGate` merges into **workspacePolicyValidation** publish branch (CW8-02), not a fourth stage.

---

## 4. Critical invariant — workspace rules seam

**Binding:** workspace-specific product rules are allowed **only** through `workspacePolicyValidation` (flat hooks today; manifest `workspacePolicy` module CW8-03).

| Forbidden in host/core | Allowed in policy stage |
|------------------------|-------------------------|
| `if (workspaceType === "denali")` validation branches | `plugin.validation.*` hooks |
| `if (customerId === …)` rule dispatch | `plugin.wizardHost.validatePublishReadiness` |
| Hardcoded Urban/Denali violation codes in `apps/api` | `workspacePolicy` factory (CW8-03) |
| Product id switches in `run-workspace-validation-hooks.ts` | `filterEngineValidationResult` (workspace-owned hook on plugin) |

**Registry-driven extraction** (`extractCapacity`, `extractTripDetails`) stays in the host runner — it is **workspace-generic** (field registry tags/paths), not product branching.

**Capability stage** dispatches by **manifest capability flags**, not `workspaceType` string compares. `assertCanonicalTourWritePublishGate` uses tour-core neutral label mapping (CW5-04) — not Denali/Urban branches.

CW8-07 guardrails will lint policy modules and host runners for violations of this invariant.

---

## 5. Validation context shape (SDK, CW8-02)

```ts
export type ValidationMode = "draft" | "publish";

/** Persist-path context — passed to all three pipeline stages. */
export type WorkspaceValidationPipelineContext = {
  /** Resolved plugin for validation (may differ from request workspaceType during starter bridge). */
  readonly plugin: WorkspacePlugin;
  readonly document: CanonicalDocument;
  /** Request workspace type (tenant binding), not necessarily plugin.id. */
  readonly workspaceType: string;
  readonly tenantId: string;
  readonly validationMode: ValidationMode;
  readonly validationVariant: "default" | "basic";
  /** Sync rules module for publish matrix — from generated bindings. */
  readonly rulesModule?: unknown;
  /** Publish-mode catalog allowlists — optional. */
  readonly catalogRefAllowlists?: CatalogRefAllowlists;
  /** RuleContext dimensions passed to validateCanonical. */
  readonly dimensions: Readonly<Record<string, string>>;
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

**Flat hook compatibility:** `WorkspaceValidationHooks` remains on `WorkspacePlugin.validation`; policy stage invokes hooks until CW8-06 retires flat path.

**Policy module type (CW8-03 preview):**

```ts
export type WorkspacePolicyValidator = {
  readonly validate?: (ctx: WorkspaceValidationPipelineContext) => WorkspaceViolation | null;
};
```

Factory: `createTourWorkspacePolicyValidator(): WorkspacePolicyValidator` — additive rules only; cannot skip shared/capability stages.

---

## 6. Capability registration ordering

Capability validators register via **manifest `capabilities` block** → codegen `workspace-capability-validation-bindings.generated.ts` (CW8-02).

| Rule | Detail |
|------|--------|
| Order source | Stable sort of capability keys at codegen (same determinism as CW7-02 / CW6-03 profile expansion) |
| Dispatch | Runner iterates bindings; skips capabilities with `supported: false` or absent block |
| Registration timing | Bindings generated at `pnpm run generate:workspace-registry` — not runtime discovery |
| Adding a capability | Manifest change + regen only — zero host edits |
| Conflicts | First binding in order wins on short-circuit; bindings must not overlap responsibility |

Example binding shape (CW8-02):

```ts
// generated — illustrative
export const WORKSPACE_CAPABILITY_VALIDATORS: readonly CapabilityValidatorBinding[] = [
  { capabilityId: "workspaceBooking", run: runBookingCapabilityValidation },
  { capabilityId: "workspaceEquipment", run: runEquipmentCapabilityValidation },
  { capabilityId: "workspaceTransport", run: runTransportCapabilityValidation },
];
```

---

## 7. Workspace policy ownership

| Owner | Responsibility |
|-------|----------------|
| **Workspace package** | `WorkspaceValidationHooks`, `validatePublishReadiness`, `filterEngineValidationResult`, future `workspacePolicy` module |
| **Manifest author** | Declares `workspacePolicy.module` + `export` (CW8-03); profile expansion copies author block (author wins over profile catalog) |
| **Host runner (`apps/api`)** | Orchestrates stages, registry extraction, mode resolution — **no product rules** |
| **platform-core** | Structural `validateCanonical` only |
| **tour-core** | Neutral publish lifecycle / booking ports consumed by capability stage |

Policy modules **must not** import `apps/*` or sibling workspace product packages (CW8-07 coupling guard).

---

## 8. Existing-hook mapping table (today → pipeline)

### 8.1 Call-site inventory

| Symbol / file | Current role | Pipeline stage | Notes |
|---------------|--------------|----------------|-------|
| `PlatformWizardEngine.validateCanonical` | Structural + exposure validation | **sharedValidation** | Via `canonical-validation-sync.ts` |
| `plugin.wizardHost.filterEngineValidationResult` | Post-engine violation filter | **sharedValidation** (substep 2) | Denali composite parity only |
| `assertCanonicalTourWritePublishGate` | Write-path lifecycle gate | **Outside pipeline** | `canonical-tour-publish-orchestration.ts`; tour-core neutral |
| `assertCatalogRefIntegrity` | Publish catalog ref allowlists | **capabilityValidation** | Publish mode + allowlists present |
| `runWorkspaceValidationHooks` | Registry extract + flat hooks | **workspacePolicyValidation** | `checkCapacity` then `checkTripDetails` |
| `runValidationModePublishGate` | Publish readiness matrix | **workspacePolicyValidation** | `validatePublishReadiness`; publish mode only |
| `resolveValidationMode` | Draft vs publish inference | **Context** (pre-pipeline) | Unchanged |
| `WorkspaceValidationHooks.checkCapacity` | Capacity range policy | **workspacePolicyValidation** | Urban 1..50000; Denali noop |
| `WorkspaceValidationHooks.checkTripDetails` | Forbidden transport/itinerary | **workspacePolicyValidation** | Urban; Denali noop |
| `WorkspaceWizardHostHooks.validatePublishReadiness` | Publish matrix | **workspacePolicyValidation** | Denali; Urban absent |
| `validateUrbanCatalogFieldValue` | Per-field catalog rules | **workspacePolicyValidation** (CW8-05) | Not wired to persist path today — migration target |
| Future `workspacePolicy` manifest module | Custom rules | **workspacePolicyValidation** | CW8-03; CW6-05B proof |

### 8.2 Denali vs Urban parity witness

| Check | Denali today | Urban today | Stage |
|-------|--------------|-------------|-------|
| `validateCanonical` | platform-core | platform-core | sharedValidation |
| `filterEngineValidationResult` | Denali hook | absent (pass-through) | sharedValidation |
| Publish lifecycle gate (API write) | tour-core via dispatch | tour-core via dispatch | capabilityValidation |
| `checkCapacity` | noop → null | 1..50000 range | workspacePolicyValidation |
| `checkTripDetails` | noop → null | forbidden transport/itinerary | workspacePolicyValidation |
| `validatePublishReadiness` | Denali matrix | absent → skip | workspacePolicyValidation (publish) |
| `assertCatalogRefIntegrity` | when allowlists injected | same | capabilityValidation (publish) |

**CW8-04/05 migrations:** golden parity via CW0-07 publish goldens + existing API specs; order change must not alter first violation code/message.

### 8.3 Today vs target call graph

```text
TODAY (validateCanonicalDocumentWithEngine):
  assertCanonicalDocument
  → validateCanonical
  → filterEngineValidationResult?     ─┐
  → runWorkspaceValidationHooks       ─┼─ implicit flat bag
  → runValidationModePublishGate      ─┘
  → assertCatalogRefIntegrity? (publish)

TARGET (CW8-02, flag-gated):
  assertCanonicalDocument
  → runWorkspaceValidationPipeline
      sharedValidation    ← validateCanonical + filter
      capabilityValidation ← lifecycle + catalog refs + capability ports
      workspacePolicyValidation ← flat hooks + publish matrix + policy module
```

---

## 9. Host runner (CW8-02 sketch)

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

## 10. CW6-05B / CW8-03 join

CW6-05B requires a synthetic profile workspace to add **two custom policy rules** via manifest only:

1. CW6-04 scaffold workspace with `profile: "starter-outdoor"`
2. CW8-03 `workspacePolicy` module exporting validator factory
3. CW6-05B cert: rules fire in **workspacePolicyValidation** after capability stage; zero host edits

Profile expansion must copy `workspacePolicy` block from author manifest (author wins); profile catalog must not embed workspace-specific policy modules.

---

## 11. Guardrails (CW8-07 preview)

- Pipeline order certification spec (stage mock ordering)
- Policy modules cannot import `apps/*` or `packages/workspaces/denali` product ids (extend coupling guard)
- Lint: policy modules must not call `validateCanonical` directly (shared stage only)

---

## 12. Tests required (CW8-02+)

| Test | Scope |
|------|-------|
| `run-workspace-validation-pipeline.spec.ts` | order + short-circuit |
| `run-workspace-validation-hooks.spec.ts` | legacy parity (existing, extend) |
| `cw8-02-flag-parity.spec.ts` | flag on/off identical violations Denali/Urban fixtures |
| `cw8-04-denali-pipeline-parity.spec.ts` | CW0-07 goldens |
| `cw8-07-pipeline-order-cert.spec.ts` | certification |
| `workspace-policy-module.spec.ts` | CW8-03 synthetic two-rule workspace |

---

## 13. Shared files future implementation MUST touch

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

## 14. CW8-01 closure checklist

| Item | Status |
|------|--------|
| Three stages defined | ✅ |
| Stage order fixed (shared → capability → policy) | ✅ |
| Short-circuit semantics | ✅ inter- and intra-stage |
| Error aggregation semantics | ✅ first-violation; multi-collect only inside sharedValidation engine |
| Deterministic ordering | ✅ §3.3 substeps + manifest capability order |
| Sync/async expectations | ✅ sync pipeline; async only for plugin resolution |
| Validation context shape | ✅ §5 full `WorkspaceValidationPipelineContext` |
| Capability registration ordering | ✅ §6 manifest → codegen bindings |
| Workspace policy ownership | ✅ §7 |
| Absence behavior | ✅ §3.6 |
| Failure behavior | ✅ §3.7 |
| Critical invariant (policy seam only) | ✅ §4 |
| Flat hooks mapped | ✅ §8 policy stage |
| `validatePublishReadiness` mapped | ✅ policy publish branch |
| Denali/Urban parity plan | ✅ §8.2 |
| CW8-03 seam preview | ✅ `workspacePolicy` block |
| CW6-05B join documented | ✅ §10 |
| Implementation deferred | ✅ CW8-02+ |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw8-01-validation-pipeline-contract.md`.*
