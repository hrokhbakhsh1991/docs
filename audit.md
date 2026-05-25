# Architectural Audit — Tour Wizard Rule Engine vs Patchwork

**Generated:** 2026-05-25  
**Scope:** `packages/shared-contracts` workspace registry, `apps/web` create/edit wizard rails, Denali field registry codegen, git history since **2026-05-15** (base `60b07f5`).  
**Method:** Read-only inspection; no code changes.

---

## Registry Core

### `TourWorkspaceDefinition` interface (verbatim)

Source: `packages/shared-contracts/src/tours/workspace-definition.ts`

```typescript
import type { TourFormProfile } from "@repo/types";

export interface WorkspaceInvariantViolation {
  code: string;
  message: string;
}

/**
 * Strategy/Contract for a Tour Workspace (e.g. Denali, Arctic).
 * Aligned with map.md §B1 and §Phase 3.
 */
export interface TourWorkspaceDefinition {
  readonly profile: TourFormProfile;
  readonly version: number;
  
  /** Roots expected in DTOs and Presets (e.g. basicInfo, programNature for Denali). */
  readonly roots: readonly string[];

  /** UI Rail hint for the web wizard. */
  readonly ui: {
    readonly wizardMode: "classic" | "denali";
  };

  /** Invariant checks (logic rules beyond simple types). */
  readonly validation: {
    readonly checkCapacity: (capacity: number) => WorkspaceInvariantViolation | null;
    readonly checkTripDetails: (tripDetails: any, transportModes?: readonly string[] | null) => WorkspaceInvariantViolation | null;
  };

  /** Lifecycle contract (map.md §B4 and §Phase 4). */
  readonly lifecycle: {
    readonly initialStatus: string;
    readonly publishStatus: string;
    readonly allowedTransitions: readonly { from: string; to: string }[];
  };

  /** Workspace actions (map.md §Phase 1). */
  readonly actions?: {
    /** Apply workspace-specific invariants (normalization). */
    readonly applyInvariants?: <T>(form: T) => T;
  };
}
```

### `TOUR_WORKSPACE_DEFINITIONS` (verbatim registry object)

Source: `packages/shared-contracts/src/tours/workspace-registry.ts`

```typescript
import type { TourFormProfile } from "@repo/types";
import type { TourWorkspaceDefinition } from "./workspace-definition";
import { DENALI_WORKSPACE } from "./workspaces/denali";
import { ARCTIC_WORKSPACE } from "./workspaces/arctic";

/**
 * Registry of workspace definitions (map.md §B3).
 */
export const TOUR_WORKSPACE_DEFINITIONS: Record<string, TourWorkspaceDefinition> = {
  denali_pilot: DENALI_WORKSPACE,
  nature_trip: ARCTIC_WORKSPACE,
  urban_event: DENALI_WORKSPACE,
};

export function getTourWorkspaceDefinition(profile: TourFormProfile): TourWorkspaceDefinition | null {
  return TOUR_WORKSPACE_DEFINITIONS[profile] ?? null;
}
```

### Resolved workspace entries (what the registry points at)

**`DENALI_WORKSPACE`** — `packages/shared-contracts/src/tours/workspaces/denali.ts`

| Field | Value |
|-------|--------|
| `profile` | `"denali_pilot"` |
| `version` | `1` |
| `roots` | `["basicInfo", "programNature", "logistics", "capacity", "pricing", "itinerary", "participation", "policies", "photos"]` |
| `ui.wizardMode` | `"denali"` |
| `validation` | `checkDenaliPilotCapacity`, `checkDenaliPilotTripDetails` (from `denali-invariants.ts`) |
| `lifecycle` | `initialStatus: "draft"`, `publishStatus: "published"`, transitions draft→published, published→archived |

**`ARCTIC_WORKSPACE`** — `packages/shared-contracts/src/tours/workspaces/arctic.ts`

| Field | Value |
|-------|--------|
| `profile` | `"nature_trip"` |
| `version` | `1` |
| `roots` | classic tour-create roots (overview, logistics, capacity, itinerary, participation, policies, themeDetails, etc.) |
| `ui.wizardMode` | `"classic"` |
| `validation` | Arctic capacity / trip-detail checks |
| `lifecycle` | Same draft/publish pattern as Denali |

**Registry alias:** `urban_event` maps to the same `DENALI_WORKSPACE` object as `denali_pilot` (Denali 6-tab rail).

### Secondary registry (Denali field / rule matrix — not `TourWorkspaceDefinition`)

Denali step fields and codegen rules live separately:

- SSOT data: `apps/web/src/features/tours/wizard/denali/registry/denaliFieldRegistryData.ts`, `denaliRuleMatrixRecipes.ts`
- Generated: `denaliRuleSet.generated.ts`, `denaliCanonicalPathMap.generated.ts`, `denaliTourCreateBaseSchema.generated.ts`
- API: `DenaliFieldRegistry.ts` (`denaliRegistryCanonicalToFormMap`, `denaliRegistryToRuleFields`)

This layer drives **field visibility/required** inside the Denali rail; it does **not** choose Denali vs classic.

---

## Rule Execution Logic

### A. Which wizard shell mounts (Denali vs classic) — **primary registry read**

| Step | Function / location | What it does |
|------|---------------------|--------------|
| 1 | `useTenantWizardTemplate()` | Loads workspace template row (`baseProfile`, JSON). |
| 2 | `resolveWorkspaceTourFormProfileFromTemplate(template)` | `apps/web/src/features/tours/wizard/resolveWorkspaceTourFormProfile.ts` — walks 7 candidate keys; first valid `TourFormProfile` wins; else `DEFAULT_TOUR_FORM_PROFILE` + source `"missing"`. |
| 3 | `validateWorkspaceTemplateAtWizardLoad(template, resolved)` | `strict-profile-validator.ts` — fails closed if Denali-shaped template has `baseProfile === "general"` or resolved profile is `"general"`. |
| 4 | **`isDenaliPilotFormProfile(profile)`** | **`apps/web/src/features/tours/wizard/isDenaliWizardContext.ts`** — **`getTourWorkspaceDefinition(profile)`** then **`return ws?.ui.wizardMode === "denali"`**. |
| 5 | `TourCreateWizard` render branch | `apps/web/src/components/tours/wizard/TourCreateWizard.tsx` **L112–118**: `DenaliCreateTourWizard` vs `ClassicTourCreateWizardRoot`. |

**Exact function that reads the workspace registry and decides the rail:**

```typescript
// isDenaliWizardContext.ts
export function isDenaliPilotFormProfile(profile: TourFormProfile | string | null | undefined): boolean {
  const ws = getTourWorkspaceDefinition(profile as TourFormProfile);
  return ws?.ui.wizardMode === "denali";
}
```

Orchestrator (current):

```112:118:apps/web/src/components/tours/wizard/TourCreateWizard.tsx
  const profile = resolveWorkspaceTourFormProfileFromTemplate(wizardTemplateQuery.data);

  if (isDenaliPilotFormProfile(profile)) {
    return <DenaliCreateTourWizard />;
  }

  return <ClassicTourCreateWizardRoot />;
```

### B. Which **step component** renders inside Denali — **not** workspace registry

| Step | Function | Mechanism |
|------|----------|-----------|
| 1 | `getDenaliWizardVisibleSteps(form, mergedRuleSet)` | Filters tab IDs from merged template rule set + form (`denaliRuleAccess` / registry rules). |
| 2 | **`DenaliStepBody({ stepId })`** | **`apps/web/src/components/tours/wizard/DenaliCreateTourWizard.tsx` ~L155** — hardcoded **`switch (stepId)`** → `DenaliBasicInfoStep`, `DenaliLogisticsStep`, `DenaliPhotosStep`, `DenaliReviewStep`, etc. |
| 3 | Per-field UI | `denaliUIAdapter.ts` (`isDenaliFieldContextuallyVisible`, `isDenaliFieldRequired`) + `useDenaliStepFieldRules` — reads **generated** `denaliRuleSet` + hand branches for transport/pricing paths. |

### C. Classic rail step rendering

`legacy/ClassicTourCreateWizard.tsx` — step visibility via `profileRules` / `fieldGroups.ts` (profile-keyed tables like `urban_event`, `denali_pilot`), and JSX gated by `currentStepKey === "basicInfo"` etc. **Does not** call `getTourWorkspaceDefinition` for each field.

### D. Original Rule Engine design (removed) vs current stack

**Documented Phase-1 modules (deleted; see `docs/TEST-REPORT.md`, `geminicli-audit.md`):**

| Removed file | Intended role |
|--------------|----------------|
| `denaliRules.ts` | Rule set assembly |
| `denaliRuleEngine.ts` | Central evaluate |
| `useDenaliWizardRules.ts` | React hook wiring |
| `ruleAwareValidation.ts` | Submit validation through engine |

**Current stack (patchwork on codegen):**

1. Codegen rule matrix → `denaliRuleSet.generated.ts`
2. `denaliUIAdapter.ts` + `denaliRuleRequired.ts` — contextual visibility/required with **manual `if (path === …)`** branches
3. `denaliInvariantEngine.ts` — submit-time invariants beside Zod
4. `denaliCanonicalIssuePaths.ts` — **manual** `switch` mapping canonical paths → RHF paths (parallel to generated map)
5. `evaluateFormRules.ts` — used in **edit/specs**, not wired to create wizard shell
6. `withDenaliWizardRailTestingOverrides` — dev-only step injection

---

## The 'Spaghetti' Audit

Hardcoded JSX, Zod, or profile tables that **bypass** `TourWorkspaceDefinition` / Denali field registry as the single authority.

| ID | Violation | Why it bypasses the registry |
|----|-----------|------------------------------|
| V-01 | `DenaliStepBody` `switch (stepId)` in `DenaliCreateTourWizard.tsx` | Step → component map is static; not driven by workspace `roots` or field registry entries. |
| V-02 | Dual Zod: `schemas/denaliCanonicalTourSchema.ts` (submit) vs `denaliTourCreateBaseSchema.generated.ts` / `.ts` wrapper | Two validation surfaces; generated base schema still exported with test UUID constants. |
| V-03 | `DENALI_WIZARD_TEST_DESTINATION_ID` / `DENALI_WIZARD_TEST_THEME_ID` in `denaliTourCreateBaseSchema.ts` | Test fixtures embedded in production schema module. |
| V-04 | `schemas/denaliCanonicalIssuePaths.ts` manual path switch | Duplicates `denaliCanonicalPathMap.generated.ts`. |
| V-05 | `denaliUIAdapter.ts` hardcoded canonical paths (`transport.transportCost`, `pricing.basePricePerPerson`, …) | Visibility/required not purely from generated rule rows. |
| V-06 | `profileRules/` + `fieldGroups.ts` profile tables (`urban_event`, `denali_pilot`, …) | Classic rail + some tests use hand-maintained visibility, not `TOUR_WORKSPACE_DEFINITIONS`. |
| V-07 | `tourWizardProfileResolve.ts` — `!== "general"`, theme/tourType fallbacks | Profile inference chain parallel to `resolveWorkspaceTourFormProfileFromTemplate`. |
| V-08 | `legacy/ClassicTourCreateWizard.tsx` default `profileSchemaRef = "general"` | Classic wizard can run with legacy profile ref independent of template `baseProfile`. |
| V-09 | `legacy/profile/ProfileGate.tsx` | Extra profile gating layer on classic steps. |
| V-10 | `basicInfo.tourType` in form vs UI `category` / `duration` / `eventVariant` | Adapter splits/composes tour kind outside registry field IDs. |
| V-11 | `meetingPoint` in canonical schema + `denaliCanonicalFormAdapter.ts` | Persisted in model; no Denali step JSX editor in registry-driven UI. |
| V-12 | Smoke `12-denali-verification-matrix.spec.ts` uses `denali-tour-category-event` | Stale test id; UI uses `denali-basics-category` (registry-aligned id). |
| V-13 | `evaluateFormRules.ts` not imported by `TourCreateWizard` / `DenaliCreateTourWizard` | Rule evaluator exists but create flow uses adapter + invariant engine instead. |
| V-14 | `transformTourToDenaliWizardValues.ts` / clone prefill | Hand mapping from API tour DTO → wizard form. |
| V-15 | `tourCreationPresetApply.ts` | Preset merge logic outside registry. |
| V-16 | `components/tours/wizard/schemas/tourCreateSchema.ts` (non-legacy path if any import remains) | Classic Zod separate from workspace contract. |
| V-17 | Settings builder `tour-wizard-template-builder-form.tsx` + API `validate-workspace-wizard-template.ts` | Second template-validation path for admin UI. |
| V-18 | `isDenaliWizardContext` fallback `getTourWorkspaceDefinition(input.formProfile ?? "general")` | `"general"` is not in `TOUR_WORKSPACE_DEFINITIONS`; null workspace unless resolved elsewhere. |

---

## Mapping Audit

Manual adapter / bridge files (canonical ↔ form ↔ API ↔ template). These are intentional translation layers but constitute **mapping drift** risk vs generated path maps.

| File | Role |
|------|------|
| `apps/web/src/features/tours/wizard/denali/denaliCanonicalFormAdapter.ts` | `denaliFormToCanonical`, `denaliCanonicalToForm`, `canonicalDurationToBasicsDuration` |
| `apps/web/src/features/tours/wizard/denali/canonicalTemplateHydration.ts` | Template JSON → form hydration |
| `apps/web/src/features/tours/wizard/denali/templateCanonicalBridge.ts` | Re-exports `@repo/types` `canonicalToTemplate` / `templateToCanonical` |
| `packages/types/src/denali/templateCanonicalMapping.ts` | Template ↔ canonical persistence shape |
| `packages/types/src/denali/denaliCanonicalFromForm.ts` | Form-like → canonical model (shared) |
| `apps/web/src/features/tours/wizard/schemas/denaliCanonicalIssuePaths.ts` | API/canonical issue path → RHF `FieldPath` (manual switch) |
| `apps/web/src/features/tours/wizard/schemas/denaliWizardCanonicalResolver.ts` | Resolver wiring for submit |
| `apps/web/src/features/tours/wizard/denali/rules/denaliCanonicalRuleAdapter.ts` | `canonicalDurationToRuleModelDuration` |
| `apps/web/src/features/tours/wizard/denali/denaliFormHydration.ts` | Edit/create hydration from tour row |
| `apps/web/src/features/tours/wizard/denali/hydrateAsyncAssets.ts` | Async photo/asset hydration |
| `apps/web/src/features/tours/clone/transformTourToDenaliWizardValues.ts` | Clone tour → Denali wizard values |
| `apps/web/src/features/tours/clone/transformTourToWizardValues.ts` | Clone → classic wizard values |
| `apps/web/src/features/tours/edit/updateTourDtoFromDenaliWizardForm.ts` | Denali form → update DTO |
| `apps/web/src/features/tours/wizard/domain/createTourFromWizard.ts` | Create payload assembly |
| `apps/web/src/features/tours/wizard/domain/ruleModelConverter.ts` | Rule model conversions (classic/edit) |
| `apps/web/src/features/tours/wizard/tourCreationPresetApply.ts` | Creation preset → form |
| `apps/web/src/features/tours/wizard/sources/loadWizardPrefill.ts` | Prefill sources merge |
| `apps/web/src/features/tours/wizard/resolveWorkspaceTourFormProfile.ts` | Template → `TourFormProfile` (multi-source) |
| `apps/web/src/features/tours/wizard/denali/transport/patchDenaliTransportForMode.ts` | Transport mode patches |
| `apps/web/src/features/tours/wizard/denali/denaliPhotoPersistence.ts` | Photo upload persistence mapping |
| `apps/web/src/features/tours/wizard/denali/pickDenaliWizardDraftForRestore.ts` | Draft envelope pick/restore |
| `apps/web/scripts/generate-denali-wizard-config.ts` | Codegen driver for registry artifacts |

---

## Git Divergence

**Window:** commits after `60b07f5` (last commit before 2026-05-15) through `HEAD` (2026-05-25).  
**Scale:** ~254 files under wizard + `shared-contracts`; +21k lines in `apps/web/src/features/tours/wizard` alone.

### Key commits (patchwork timeline)

| Commit | Date | Summary |
|--------|------|---------|
| `dec6400` | 2026-05-17 | init |
| `dbc742d` | 2026-05-18 | update |
| `41cb056` | 2026-05-21 | Denali pilot wizard; **introduces** workspace registry + monolithic `TourCreateWizard` with inline `getTourWorkspaceDefinition` |
| `778c0c7` | 2026-05-24 | Diagnostics/E2E; draft banner `if` patch |
| `366333c` | 2026-05-24 | Denali edit, canonical templates, transport |
| `b1b3571` | 2026-05-25 | **Splits** classic to `legacy/`; slim orchestrator; `StrictProfileValidator`; multi-source profile resolution |

### Lines added (last ~10 days) with `if` / `else` / hardcoded fallbacks — patches that altered Engine behavior

Format: **commit · file · added logic (paraphrase from diff)**

| Commit | File | Added patch (breaks / sidesteps original engine) |
|--------|------|--------------------------------------------------|
| `41cb056` | `packages/shared-contracts/.../workspace-registry.ts` | **New** registry; `urban_event: DENALI_WORKSPACE` alias — rail by DB `base_profile` only if resolver returns that key. |
| `41cb056` | `TourCreateWizard.tsx` (~L1201–1206) | **Original rail:** `const workspace = getTourWorkspaceDefinition(wizardTemplateQuery.data.baseProfile); if (workspace?.ui.wizardMode === "denali")` — used **raw** `data.baseProfile`, not multi-source resolver. |
| `41cb056` | `resolveWorkspaceTourFormProfile.ts` | **New** — `for (const candidate of candidates) { if (isTourFormProfile(candidate.value)) return … }` else `chosen: DEFAULT_TOUR_FORM_PROFILE, source: "missing"`. |
| `41cb056` | `denaliUIAdapter.ts` | **New file** — many `if (path === "transport.…")` / `if (model == null)` branches on top of generated rules. |
| `41cb056` | `denaliInvariantEngine.ts` | **New** — invariant checks outside deleted `denaliRuleEngine.ts`. |
| `41cb056` | `denaliCanonicalIssuePaths.ts` | **New** — manual `switch` path mapping. |
| `778c0c7` | `TourCreateWizard.tsx` | `{showDraftBanner ? (` → `{showDraftBanner && isFirstStep ? (` — UI conditional patch (classic shell era). |
| `778c0c7` | `DenaliCreateTourWizard.tsx` | Hydrate/draft recovery branches (`if (steps.length === 0) return;`, draft conflict handling). |
| `366333c` | `canonicalTemplateHydration.ts`, `denaliFormHydration.ts` | Template/tour hydration `if` chains for legacy template rows. |
| `366333c` | `updateTourDtoFromDenaliWizardForm.ts` | Edit-path DTO mapping conditionals. |
| `b1b3571` | `TourCreateWizard.tsx` | Replaced 1000+ line shell with orchestrator; **added** `try/catch` around `validateWorkspaceTemplateAtWizardLoad`; **added** `profileValidationError` UI block. |
| `b1b3571` | `strict-profile-validator.ts` | `if (!isDenaliStructuredTemplate(template)) return;` · `if (template.baseProfile === "general") throw` · `if (resolvedProfile === "general") throw` — **fail-closed** guard for mis-patched DB (`4931f36a-…` / `general` case). |
| `b1b3571` | `data-legacy-error.ts` | Legacy profile mismatch error type for orchestrator. |
| `b1b3571` | `denali-template-shape.ts` | `isDenaliStructuredTemplate` heuristic `if` on template JSON shape. |
| `b1b3571` | `legacy/ClassicTourCreateWizard.tsx` | Moved classic wizard; preserves `profileSchemaRef` / step `if` rendering. |
| `b1b3571` | `resolveWorkspaceTourFormProfile.ts` | Extended candidates: `base_profile`, `formProfile`, `canonicalData.formProfile`, `workspaceSettings.profile`. |

### Before vs after — rail selection (the critical divergence)

**2026-05-21 (`41cb056`) — registry read on template row only:**

```typescript
const workspace = getTourWorkspaceDefinition(wizardTemplateQuery.data.baseProfile);
if (workspace?.ui.wizardMode === "denali") {
  return <DenaliCreateTourWizard />;
}
return <ClassicTourCreateWizardRoot />;
```

**2026-05-25 (`HEAD` / `b1b3571`) — resolver + strict validator + `isDenaliPilotFormProfile`:**

```typescript
const resolved = resolveWorkspaceTourFormProfileFromTemplate(template);
validateWorkspaceTemplateAtWizardLoad(template, resolved);
// ...
const profile = resolveWorkspaceTourFormProfileFromTemplate(wizardTemplateQuery.data);
if (isDenaliPilotFormProfile(profile)) {
  return <DenaliCreateTourWizard />;
}
return <ClassicTourCreateWizardRoot />;
```

**Impact:** A template row with `baseProfile: "general"` but Denali-shaped JSON now **blocks** the wizard (`StrictProfileValidator`) instead of silently routing to classic via `getTourWorkspaceDefinition("general") === null`. Fixing DB to `urban_event` restores Denali rail **only if** resolver picks `urban_event` first among candidates.

### Sample added `if` lines in `denaliUIAdapter.ts` (entire file new since `60b07f5`)

```
+  if (step === "review") {
+  if (model == null) return [];
+  if (path === "transport.transportCost") {
+  if (path === "transport.allowPersonalCar") {
+  if (!isDenaliFieldContextuallyVisible(canonicalPath, form, options)) return false;
+  if (field.hidden) return false;
+  if (step !== "review" && field.step !== step) return false;
```

### `strict-profile-validator.ts` (new in `b1b3571`) — full guard logic

```typescript
static assertNoLegacyGeneralOnDenaliStructure(template: TenantWizardTemplate): void {
  if (!isDenaliStructuredTemplate(template)) {
    return;
  }
  if (template.baseProfile === "general") {
    throw new DataLegacyError(DATA_LEGACY_PROFILE_MISMATCH_MESSAGE);
  }
}

static assertResolvedMatchesTemplate(input: StrictProfileValidationInput): void {
  const { template, resolvedProfile } = input;
  if (!isDenaliStructuredTemplate(template)) {
    return;
  }
  if (resolvedProfile === "general") {
    throw new DataLegacyError(DATA_LEGACY_PROFILE_MISMATCH_MESSAGE);
  }
  // … additional match checks …
}
```

---

## Summary: Original Engine vs Current Patchwork

| Layer | Original design intent | Current state |
|-------|------------------------|---------------|
| Workspace rail | Single `TourWorkspaceDefinition` per profile; `wizardMode` chooses shell | Implemented in `shared-contracts`; web uses resolver + strict validator on top |
| Denali rules | Central `denaliRuleEngine` + hook | Codegen + `denaliUIAdapter` + `denaliInvariantEngine` + manual issue paths |
| Step UI | Registry-driven components (planned) | Hardcoded `switch (stepId)` + per-step TSX |
| Profile authority | `base_profile` column | 7 candidate keys + `DEFAULT_TOUR_FORM_PROFILE` fallback + legacy `"general"` rejection |
| Validation | One Zod + rule engine | Split Zod schemas; `evaluateFormRules` unused on create path |

**Operational note:** Template `4931f36a-…` with `base_profile = general` and Denali JSON triggers `DataLegacyError` by design after `b1b3571`; patch DB to `urban_event` (or `denali_pilot`) so `getTourWorkspaceDefinition` and `isDenaliPilotFormProfile` align.

---

*End of audit. Single artifact: `audit.md`.*
