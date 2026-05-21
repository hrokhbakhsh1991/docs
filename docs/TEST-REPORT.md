# Test & audit reports

## Denali Rule Layer Integration Report

**Date:** 2026-05-19

### Files created

| File | Role |
|------|------|
| `apps/web/src/features/tours/wizard/denali/rules/denaliRules.ts` | Rule definitions per category |
| `apps/web/src/features/tours/wizard/denali/rules/denaliRuleEngine.ts` | `resolveDenaliRules()` + duration adapters |
| `apps/web/src/features/tours/wizard/denali/rules/useDenaliWizardRules.ts` | RHF hook (read-only from `basicInfo.tourType`) |
| `apps/web/src/features/tours/wizard/denali/rules/index.ts` | Public exports |
| `apps/web/src/features/tours/wizard/denali/rules/denaliRuleEngine.spec.ts` | Unit tests |

### Where the rule engine is used

| Component | Usage |
|-----------|--------|
| `DenaliBasicInfoStep` | `useDenaliWizardRules` — event variant visibility, end datetime visibility, disabled duration options |
| `DenaliProgramNatureStep` | `showOutdoorProgramFields()` for difficulty + hiking block |
| `DenaliReviewStep` | `useDenaliCanonical` — outdoor + event variant summary rows |
| `DenaliReviewParticipantSection` | `ui.isVisible("review", …)` for mountain `submit_only` participant fields |

Transport and pricing steps unchanged (no category-conditioned UI).

### UI logic replaced

- `denaliCategoryRequiresEventVariant` + `basics.duration === "multi_day"` → `rules.showEventVariant()` / `rules.showEndDateTime()`
- `deriveDenaliIsOutdoorTour(tourType)` in program/review → `rules.showOutdoorProgramFields()`
- Hard-coded duration list → `isFormDurationAllowedForCategory` + disabled `<option>`
- Review always showing event variant → conditional on `showEventVariant()`

### Confirmation (Phase 1)

- Phase 1 was UI-only; see **Phase 2** below for Zod integration.
- No new `useEffect` mutations; rules are read-only at render time
- Form state shape unchanged (`basicInfo.tourType` slug adapter retained)

---

## Denali Rule Engine — Zod Integration Report (Phase 2)

**Date:** 2026-05-19

### Goal

Unify Zod step/submit validation with `denaliRules` as the single business-rule source. No API or mapper changes; legacy schema fields retained.

### Files created

| File | Role |
|------|------|
| `apps/web/src/features/tours/wizard/denali/validation/ruleAwareValidation.ts` | `withDenaliRuleEngine` / `ruleAwareSchema` — wraps base Zod with `refineDenaliRuleEngine` |
| `apps/web/src/features/tours/wizard/denali/validation/denaliRuleValidation.ts` | Rule-driven refine, required-path resolver, issue filtering, `stripRuleHiddenFieldValues` |
| `apps/web/src/features/tours/wizard/denali/validation/denaliRuleValidation.spec.ts` | Event outdoor suppression, hidden-path filter |

### Files modified

| File | Change |
|------|--------|
| `denaliTourCreateSchema.ts` | Split `denaliTourCreateBaseSchema` + `refineDenaliStructuralForm`; export `denaliTourCreateSchemaRuleAware`; preprocess uses `stripRuleHiddenFieldValues` |
| `denaliTourCreateValidation.ts` | Step “Next” via `denaliTourCreateSchemaRuleAware.safeParse` + `filterZodIssuesForRuleVisibility` + step root filter |
| `denaliRules.ts` | `fullFormRequiredFields` for mountain participant paths |
| `denali/index.ts` | (optional) — validation helpers imported from schema path |

### Validation logic removed from schema `superRefine`

Removed from `refineDenaliTourCreateForm` (renamed/split):

- Multi-day `endDateTime` required (→ `getDenaliValidationRequiredPaths` + `showEndDateTime()`)
- Event difficulty must be empty / outdoor difficulty + hiking required (→ rule hidden/required paths)
- Mountain min age, fitness, sports insurance (→ `fullFormRequiredFields` + mountain block in `refineDenaliRuleEngine`)

**Kept in `refineDenaliStructuralForm` (not in `denaliRules`):** date ordering, capacity min/max, transport dong, pricing paid/free, participant min/max age ordering.

### Step validation flow (replaced)

- **Before:** Per-step trigger field lists + duplicated category checks in schema refine.
- **After:** `getDenaliWizardStepIssues` → full rule-aware parse → filter hidden paths → filter by `DENALI_WIZARD_STEP_SCHEMA_ROOT`. Submit still uses `zodResolver(denaliTourCreateSchema)` (alias of rule-aware schema).

### Confirmation: API unchanged, legacy schema retained

- `mapDenaliWizardToCreateTourPayload.ts` — **not modified**
- `assert-create-tour-invariants.ts` (API) — **not modified**
- All legacy tabs/fields remain on `denaliTourCreateBaseSchema` (types only); rules gate *enforcement*, not shape.

### Risks / remaining legacy coupling

- **Structural vs rule split:** Transport/pricing/capacity rules still live only in Zod structural refine — intentional until Phase 3 canonical model.
- **Duration tokens:** Rules use `one_day` / `multi_day`; form slugs use `single_day` / `multi_day` via `denaliRuleEngine.ts`.
- **Off-rail sections:** `participantRequirements` / `policies` validated on full submit, not per MVP step (mountain fields via `fullFormRequiredFields`).
- **Dual normalize:** `normalizeDenaliWizardForm` still clears single-day `endDateTime` and transport/pricing orphans; hidden fields cleared via `stripRuleHiddenFieldValues` from `denaliRules.hiddenFields`.
- **Rule ↔ message map:** Persian copy in `denaliRuleValidation.ts` `REQUIRED_FIELD_MESSAGES` / `HIDDEN_FIELD_MESSAGES` must stay aligned when adding paths.

### Suggested Phase 3

1. Prune ghost fields from `denaliTourCreateBaseSchema` → align with `DenaliCanonicalTourModel` (`packages/types`).
2. Drive `mapDenaliWizardToCreateTourPayload` from canonical shape only; generate `hiddenFields` / wire keys from one manifest shared with API strip lists.
3. Move structural transport/pricing rules into rules table or canonical invariants where product-owned.

### Denali MVP Audit (auto-generated)

- **Date:** 2026-05-19
- **Summary:** Rule layer added as UI-only source of truth for visibility and duration eligibility; refactor remains partially migrated at schema/mapper level.
- **Key Findings:**
  - 5-step Denali wizard with unified Zod validation
  - Rule engine centralizes category/duration UI behavior
  - Legacy form schema and mapper still carry non-MVP fields
  - No `useDenaliWizardSideEffects`; step validation via full schema parse
- **Risk Level:** medium
- **Recommendation:** Keep `denaliRules.ts` in sync with schema changes; consider generating hidden-field lists from one manifest in a follow-up.
