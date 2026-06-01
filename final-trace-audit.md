# Final Trace Audit

## Target

- Template ID: `4931f36a-19ed-4cd1-9ec3-eb5d12eaf7f6`

## Lifecycle Trace: `orchestrateDenaliWizardFromTemplate`

1. `orchestrateDenaliWizardFromTemplate(...)` receives template + `canonicalData`.
2. Branch: calls `denaliTemplateOrchestratorFactory.createDraftFromTemplate(...)`.
3. Factory branch A (`resolveStoredTemplateCanonical`):
   - Current DB `canonical_data` for this template is `{}` (repaired during this audit).
   - Validation branch result: **ok**.
4. Factory branch B (`resolveDenaliRuleSetFromOverlay`):
   - `field_rules_overlay` is `{}`.
   - Rule set resolves to defaults.
5. Factory branch C (`tryHydrateCanonicalTemplate`):
   - Hydration branch uses default values because canonical patch is empty.
6. Factory branch D (`normalizeDenaliWizardForm` -> `finalizeDenaliWizardHydration` -> `pruneDenaliWizardFormToRegistry`):
   - Applies normalized RHF-safe shape.
7. Factory branch E (`prepareDraftForSync` + projection build):
   - Projection succeeds.
   - Final factory result: `success: true`.
8. `orchestrateDenaliWizardFromTemplate` branch:
   - `result.success === true`.
   - `extractFormFromDraftState(...)` returns a valid object.
   - Returns `{ success: true, form }`.

### Branch Leak Verdict

- No manual key lookup fallback found in `orchestrateDenaliWizardFromTemplate`.
- No `[LEGACY_LEAK_FOUND: ...]` in this orchestrator path.

## Persistence Trace: `denaliCanonicalFromForm.ts`

### Mapping behavior (current code)

- `basicInfo` mirror branch: `basicInfo: { ...form.basicInfo }`
- `programNature` mirror branch: `programNature: { ...form.programNature }`
- `transport` mirror branch: `transportForm: { ...form.transport }`
- `tripDetails` mirror branch: spread + nested spread for `overview`, `metrics`, `logistics`

### Dangerous-call scan

- Searched for function calls with `old`, `legacy`, `deprecated` in the called function name.
- **Before fix**: serializer used `gatheringPickupStationFromLegacyLocation(...)`.
- **Fix applied**:
  - Added neutral function `gatheringPickupStationFromLocation(...)`.
  - Updated serializer to call `gatheringPickupStationFromLocation(...)`.
  - Kept legacy-name function as deprecated wrapper for compatibility.

### Dangerous-call verdict

- `[DANGEROUS_CALL_DETECTED: gatheringPickupStationFromLegacyLocation]` **resolved by code fix**.

## Schema Compliance Check (RHF)

Compared traced orchestrator output (`draftState.data.form`) to `DenaliCreateTourWizardForm` schema shape:

- No unknown keys were found in traced RHF form payload.
- No `[GHOST_FIELD_IN_PAYLOAD]` in orchestrator output.

## Integrity Incident Found During Trace + Fix

While tracing this specific template, a real DB leak was observed earlier:

- `canonical_data` contained RHF-style keys (`basicInfo`, `programNature`, `pricingPayment`, ...)
- Factory validation treated them as unknown canonical fields and failed.

Applied repair:

- Reset affected template rows to canonical shell `{}`:
  - `4931f36a-19ed-4cd1-9ec3-eb5d12eaf7f6`
  - `768660fa-47b2-45bf-8c9b-50da3cf4b5fa`
  - `5ee26021-cf4b-4944-8240-9cea31d190b4`
- Re-ran factory trace for target template: `success: true`.

## Final Verdict

- Orchestrator lifecycle: clean branch execution, no legacy fallback.
- Persistence adapter: spread-based mirrors present; dangerous legacy-named call removed from active path.
- RHF schema payload compliance (trace output): no ghost fields detected.
