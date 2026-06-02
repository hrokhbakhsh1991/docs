# Hydration Failure Analysis

**Generated:** 2026-05-31  
**Scope:** `DenaliTemplateOrchestratorFactory.createDraftFromTemplate` → `tryHydrateCanonicalTemplate`  
**Symptom:** `failureKind: "hydration_empty"` despite Layer A Zod validation passing

---

## Executive Summary

`hydration_empty` is **not** caused by registry pruning, projection filters, or nested schema rejection after Zod passes. It is emitted when `tryHydrateCanonicalTemplate` returns **`null`**, which happens in only **two** guard branches.

The primary production trigger is a **Zod-valid empty object** `{}`:

| Stage | `{}` result |
|-------|-------------|
| `resolveStoredTemplateCanonical` / Zod | `{ ok: true }` — all Layer A fields are optional deep-partial |
| `tryHydrateCanonicalTemplate` | `null` — `hasCanonicalTemplateContent()` is false |
| Orchestrator | `failureKind: "hydration_empty"` |

A **minimal valid template** with `title` + `program.itinerary[0]` **does not** trigger `hydration_empty`. It hydrates and the orchestrator returns `success: true`. However, a **post-hydration structural invariant** silently clears `programNature.itinerary` when the tour is not classified as multi-day — this is data loss, not a hydration failure.

---

## Pipeline Trace

```
createDraftFromTemplate(template)
  │
  ├─ resolveStoredTemplateCanonical({ canonicalData, fieldRulesOverlay })
  │     └─ fail → failureKind: "canonical_validation"
  │
  ├─ resolveDenaliRuleSetFromOverlay(fieldRulesOverlay)
  ├─ defaultValues = options.defaultValues ?? resetWizardToRegistryDefaults()
  │
  ├─ tryHydrateCanonicalTemplate(resolved.canonicalData, defaultValues, undefined, ruleSet)
  │     └─ null → failureKind: "hydration_empty"   ← THIS REPORT
  │
  ├─ normalizeDenaliWizardForm(hydrated.formValues, …)
  ├─ finalizeDenaliWizardHydration(form, ruleSet)   // second invariant pass
  ├─ pruneDenaliWizardFormToRegistry(form)
  ├─ prepareDraftForSync → draftState
  └─ buildDenaliCreateTourPayloadProjection → payload
        └─ throw → failureKind: "projection"
```

**Source files:**

- Orchestrator gate: `packages/denali-domain/src/rules/factory/DenaliTemplateOrchestratorFactory.ts:90–100`
- Hydration: `packages/denali-domain/src/adapters/canonicalTemplateHydration.ts:51–94`
- Regression test for `{}` → `hydration_empty`: `apps/api/src/modules/settings-locations/tour-wizard-template-settings.service.spec.ts:224–248`

---

## Audit: `tryHydrateCanonicalTemplate` Null Return Conditions

The function has **exactly two** `return null` paths. There is no third branch, no registry check, and no projection involvement at this layer.

### Condition 1 — Non-object root

```57:59:packages/denali-domain/src/adapters/canonicalTemplateHydration.ts
  if (canonicalPatch == null || typeof canonicalPatch !== "object") {
    return null;
  }
```

| Input | Zod (via resolver) | `tryHydrate` |
|-------|-------------------|--------------|
| `null` | `{ ok: false }` — `"canonicalData must be a JSON object"` | `null` (unreachable via orchestrator) |
| `undefined` | Same | `null` |
| `"string"` | `{ ok: false }` | `null` |
| `[]` (array) | `{ ok: false }` | `null` |
| `42` (number) | `{ ok: false }` | `null` |

When called through `DenaliTemplateOrchestratorFactory`, non-object roots are rejected at the resolver and surface as `canonical_validation`, not `hydration_empty`.

### Condition 2 — No defined top-level content

```27:33:packages/denali-domain/src/adapters/canonicalTemplateHydration.ts
function hasCanonicalTemplateContent(
  patch: DenaliCanonicalPartial,
): boolean {
  return (Object.keys(patch) as (keyof DenaliCanonicalPartial)[]).some(
    (key) => patch[key] !== undefined,
  );
}
```

```62:64:packages/denali-domain/src/adapters/canonicalTemplateHydration.ts
  if (!hasCanonicalTemplateContent(patch)) {
    return null;
  }
```

| Input | `Object.keys` | `hasCanonicalTemplateContent` | Zod | Orchestrator |
|-------|---------------|--------------------------------|-----|--------------|
| `{}` | `[]` | **false** | **passes** | `hydration_empty` |
| `{ program: {} }` | `["program"]` | **true** (`{} !== undefined`) | passes | **success** |
| `{ title: "X" }` | `["title"]` | **true** | passes | **success** |
| `{ category: "mountain" }` | `["category"]` | **true** | passes | **success** (partial classification; tourType not set until both `category` + `duration` present) |

**Important nuance:** `hasCanonicalTemplateContent` checks **top-level keys only**. Nested emptiness (`program: {}`) still counts as content. JSON cannot carry `undefined` values; absent keys are simply omitted.

### What does NOT cause `null`

Once past the two guards, `tryHydrateCanonicalTemplate` **always** returns `{ formValues, wizardMeta }`:

1. `safeDenaliFormToCanonical(defaultValues)` — builds shell from registry defaults
2. `mergeDenaliCanonicalPartial(base, patch)` — deep-merges patch slices
3. `denaliCanonicalToForm(merged, defaultValues, { basics })` — maps to RHF form shape
4. Classification guard: if patch omits **both** `category` and `duration`, `tourType` is reset to defaults (does not return null)
5. `finalizeDenaliWizardHydration(form, ruleSet)` — structural invariants + visibility cleanup (may **mutate** form, never aborts)

There is **no** `return null` after line 64.

---

## Zod vs Hydration Semantic Gap

Layer A schema (`denaliCanonicalTemplateDataSchema`) is a **strict deep-partial**: every field is optional, including the root object itself.

```131:196:packages/types/src/denali/denaliCanonicalTemplateDataSchema.ts
export const denaliCanonicalTemplateDataSchema = z
  .object({
    category: z.enum(DENALI_CANONICAL_CATEGORY_VALUES).optional(),
    duration: z.enum(DENALI_CANONICAL_DURATION_VALUES).optional(),
    title: z.string().trim().optional(),
    // … all other slices optional …
    program: denaliTemplateProgramSchema.optional(),
    // …
  })
  .strict();
```

Therefore:

- **`{}` is schema-valid** — no required fields at any depth
- **`tryHydrateCanonicalTemplate` treats `{}` as “no template to apply”** — intentional early exit
- This is **by design** in the service regression suite, not a regression

**Classification note:** `patchDeclaresClassification` requires **both** `category` and `duration` before tour type is derived from the patch. A patch with only one of them still hydrates (Condition 2 passes) but leaves `tourType` at registry defaults.

---

## Minimal Valid Template Probe

Executed 2026-05-31 against current codebase (`denaliTemplateOrchestratorFactory` + `resolveStoredTemplateCanonical` + `tryHydrateCanonicalTemplate`).

| Canonical input | Zod | `tryHydrate` null? | Orchestrator | Notes |
|-----------------|-----|-------------------|--------------|-------|
| `{}` | ✅ | **YES** | `hydration_empty` | Primary false-negative gap |
| `{ title: "Minimal" }` | ✅ | no | **success** | Title maps to `basicInfo.title` |
| `{ title: "Minimal", program: { itinerary: [{ day: 1, activities: "Hike" }] } }` | ✅ | no | **success** | Does **not** fail hydration |
| `{ program: { itinerary: [{ day: 1, activities: "Hike" }] } }` | ✅ | no | **success** | Title stays default `""` |
| `{ program: {} }` | ✅ | no | **success** | Top-level `program` key satisfies content gate |
| `{ category: "mountain", duration: "single" }` | ✅ | no | **success** | Classification declared; tourType set |
| `null` / `[]` | ❌ | YES | `canonical_validation` | Blocked before hydration |

**Conclusion:** A minimal template with `title` + one itinerary day **cannot** produce `hydration_empty` on the current orchestrator path. If you observe `hydration_empty` with apparently non-empty canonical data, the data reaching `tryHydrateCanonicalTemplate` is effectively **`{}` or structurally empty at the top level** — verify the persisted row, migration output, or client payload **after** `templateToCanonical` / `sanitizeDenaliCanonicalTemplateData`.

---

## Post-Hydration Filters (Not `hydration_empty`, But Data Loss)

These run **after** `tryHydrateCanonicalTemplate` succeeds. They explain “my itinerary disappeared” but **not** `failureKind: "hydration_empty"`.

### 1. Global structural invariant: `syncProgramItineraryToDayCount`

```118:133:packages/denali-domain/src/normalize/structuralInvariants.ts
    case "syncProgramItineraryToDayCount": {
      const isMulti = basics?.duration === "multi_day";
      if (!isMulti) {
        form.programNature.itinerary = undefined;
        return;
      }
      const dayCount = computeDenaliTourDayCountFromKind(
        form.basicInfo.tourType as DenaliTourKind | undefined,
        form.basicInfo.startDateTime ?? "",
        form.basicInfo.endDateTime,
      );
      form.programNature.itinerary = syncDenaliItineraryRows(
        form.programNature.itinerary,
        dayCount,
      );
      return;
    }
```

Registered in `DENALI_GLOBAL_STRUCTURAL_INVARIANTS` (`denaliGlobalStructuralInvariants.ts:10`).

| Template state | Effect on `program.itinerary` |
|----------------|------------------------------|
| No `category`+`duration` in patch | `tourType` unselected → `basics.duration !== "multi_day"` → **itinerary cleared** |
| `duration: "single"` | Single-day → **itinerary cleared** |
| `duration: "multi"` + classified tourType | Itinerary synced/resized to computed day count |

**Probe confirmation:** `{ title, program: { itinerary: [day 1] } }` returned `orchSuccess: true` but `itineraryLen: null` after `finalizeDenaliWizardHydration` — itinerary was hydrated then **stripped** by this invariant.

### 2. Registry visibility: `clearWhenNotVisible`

Per-field structural invariants in `DENALI_FIELD_DEFINITIONS` clear canonical leaves when contextual visibility evaluates false (`structuralInvariants.ts:65–76`). `program.itinerary` carries tags `itinerary_hidden` / `itinerary_visible` (`denaliFieldRegistryData.ts:371–376`); hidden fields are cleared during `normalizeDenaliWizardForm` / invariant passes.

### 3. Orchestrator double-finalize

```103:105:packages/denali-domain/src/rules/factory/DenaliTemplateOrchestratorFactory.ts
    let form = normalizeDenaliWizardForm(hydrated.formValues, undefined, ruleSet);
    form = finalizeDenaliWizardHydration(form, ruleSet);
    form = pruneDenaliWizardFormToRegistry(form);
```

`tryHydrateCanonicalTemplate` already calls `finalizeDenaliWizardHydration` internally (line 91). The factory runs **a second** finalize + registry prune. This amplifies visibility/itinerary clearing but still does not produce `null` from hydration.

### 4. `pruneDenaliWizardFormToRegistry`

Rebuilds form from registry defaults and copies only registered paths. Unregistered ghost keys are dropped. Does **not** cause `tryHydrate` to return `null`.

---

## Root-Cause Decision Tree

```
failureKind === "hydration_empty"?
  │
  ├─ YES → tryHydrateCanonicalTemplate returned null
  │         │
  │         ├─ canonicalPatch is null / non-object?
  │         │     └─ Usually blocked earlier as canonical_validation
  │         │
  │         └─ hasCanonicalTemplateContent === false?
  │               └─ canonicalData is {} or equivalent empty top-level object
  │                   (Zod-valid but no keys with defined values)
  │
  └─ NO but data missing → post-hydration invariant / visibility / prune
                            (see Post-Hydration Filters section)
```

---

## Likely Production Scenarios for `hydration_empty` + Zod Pass

1. **Empty canonical row in DB** — template record exists but `canonical_data = '{}'::jsonb` (see service spec line 226).
2. **Migration / builder produced empty Layer A** — e.g. Settings Preview packer round-trip dropped all paths; persisted `{}` passes Zod.
3. **Wrong payload field at call site** — caller passes `template.canonicalData` that was already stripped to `{}` before orchestrator (not the raw DB blob).
4. **Misread logs** — `success: true` with empty itinerary is **not** `hydration_empty`; check `failureKind` explicitly.

**Not a cause:** Minimal `{ title, program.itinerary }` on the orchestrator path verified above.

---

## Recommendations

| Priority | Action |
|----------|--------|
| **P0 — Diagnostics** | Log `Object.keys(resolved.canonicalData)` and `JSON.stringify(resolved.canonicalData)` at orchestrator entry when `hydration_empty` fires. |
| **P1 — Schema gap** | Add a post-Zod guard: reject `{}` with a dedicated issue (e.g. `canonicalData: at least one field required for instantiate`) → map to `422` instead of ambiguous `400 hydration_empty`. |
| **P2 — Itinerary UX** | Document that `program.itinerary` requires multi-day classification (`category` + `duration: "multi"`) or it is cleared by `syncProgramItineraryToDayCount`. |
| **P3 — Test coverage** | Keep regression: `instantiateForWorkspace regression: resolver ok:true with empty canonical cannot succeed` (`tour-wizard-template-settings.service.spec.ts:224`). |

---

## Appendix: Error Strings

| Layer | Message / code |
|-------|----------------|
| Orchestrator | `"Template canonicalData produced no hydratable wizard fields."` |
| API service | `TEMPLATE_INSTANTIATE_SILENT_FAILURE` + `failureKind: "hydration_empty"` |
| Publish gate | `VALIDATION_PUBLISH_HYDRATION_FAILED` — same `tryHydrate == null` condition (`validate-workspace-wizard-template.ts:242–248`) |

---

*End of hydration failure analysis.*
