# @apps/web lint audit report

**Command:** `pnpm --filter @apps/web run lint` (`tsc --noEmit`)  
**Date:** 2026-05-26  
**Result:** FAILED (exit 1)  
**Total errors:** 80  

Raw log: `/tmp/apps-web-lint-report.txt` (generated in CI session)

---

## Summary by error category (TS code)

| Category | TS codes | Count | Typical cause |
|----------|----------|-------|----------------|
| Assignment type mismatch | TS2322 | 22 | Stale literals (`"denali"`), template mocks missing `canonicalData`, UI prop shapes |
| Property does not exist | TS2339 | 14 | Renamed/removed fields (`personalInsurance*`, `travelInsurance*`, i18n keys) |
| Argument type mismatch | TS2345 | 12 | `TourDetailDto` vs policy helpers; wizard template partial mocks |
| Unused symbol | TS6133, TS6196 | 10 | Dead imports / types after refactors |
| Implicit any | TS7006 | 5 | Untyped callback params in audit tests |
| Incomplete object shape | TS2739 | 4 | Test fixtures missing photo/location fields |
| Missing module export | TS2305 | 3 | `@repo/types` / content block exports |
| Excess / unknown object key | TS2353 | 3 | DTO drift (`accessLevel`, `travelInsuranceAvailable`, test keys) |
| Missing required property | TS2741 | 2 | `RegistrationIntakeSchemaMessages.peaksRequired`; template `canonicalData` |
| Wrong property name | TS2551, TS2552 | 3 | `personalInsuranceRequired` → `sportsInsuranceRequired`; typo `DenaliTemplateSchemaModel` |
| Union / literal mismatch | TS2677 | 1 | Type predicate in `DenaliTourEditForm` |
| Invalid type reference | TS2694 | 1 | Zod v4 namespace in `denaliWizardDraftContract.ts` |

---

## Suggested fix batches (assignment)

| Batch | Priority | Scope | Files | Errors | Theme |
|-------|----------|-------|-------|--------|-------|
| **A** | P0 Golden | Registration | `register-for-tour-client.tsx`, `PublicRegisterForm.tsx`, `registrations.service.ts` | 16 | Align intake schema + participation fields with `@repo/types` / shared-contracts |
| **B** | P0 Golden | Tours data layer | `lib/mappers/tour.mapper.ts` | 2 | `TourDto` / `allowPrivateCar` typing + `accessLevel` on DTO |
| **C** | P0 Golden | Wizard runtime | `ruleModelConverter.ts`, `denaliWizardDraftContract.ts`, `deriveDenaliTemplateSchema.ts`, `universal-validator.ts` | 6 | Profile literal `"denali"` → `denali_pilot`; Zod import; template type |
| **D** | P1 Golden | Wizard specs | 18 spec files under `features/tours/wizard/**` | 24 | Mock templates + `"denali"` profile literals + fixture shapes |
| **E** | P1 Golden | Tours UI (non-wizard) | `DenaliTourEditForm.tsx`, `DenaliCreateTourWizard.tsx`, workspace/* | 7 | Form paths, UI props, transport tab return type, i18n |
| **F** | P2 | Public site | `PublicTourDetailView.tsx`, `PublicCatalogGrid.tsx` | 3 | Minor unused import + `ErrorState` props |
| **G** | P2 | Content / BFF | `ContentTextBlock.tsx`, `renderPageBlock.tsx`, `bff-proxy.ts` | 4 | Exports + `BFF_CONFIG_MISSING` error code union |
| **H** | P3 | Settings / misc | `DestinationQuickAddForm.tsx`, `generate-denali-wizard-config.ts` | 7 | Regions hook shape + unused import |
| **I** | P3 | Tests / smoke | `tests/audit/*`, `tests/smoke/*` | 6 | Implicit any + smoke mock fields |

---

## Golden Path detail (65 errors, 34 files)

### Batch A — Registration (16 errors)

| File | Ln | Code | Category | Message (abbrev.) |
|------|-----|------|----------|-------------------|
| `app/(app)/tours/[id]/register/register-for-tour-client.tsx` | 98 | TS2551 | Wrong property name | `personalInsuranceRequired` → use `sportsInsuranceRequired`? |
| ↑ | 107 | TS2345 | Argument mismatch | `TourDetailDto` not assignable to `TourAllowPrivateCarInput` |
| ↑ | 123 | TS2353 | Unknown key | `travelInsuranceAvailable` not on `RegistrationOptions` |
| ↑ | 124 | TS2339 | Missing property | `travelInsuranceAvailable` on participation |
| ↑ | 169 | TS2741 | Missing required | `peaksRequired` missing on `RegistrationIntakeSchemaMessages` |
| ↑ | 245–246 | TS2339 | Missing property | `personalInsurance`, `travelInsurance` on form values |
| ↑ | 710,729 | TS2339 | Missing property | `travelInsuranceAvailable` on options |
| ↑ | 716,731 | TS2345 | Invalid field name | `register("personalInsurance")` / `travelInsurance` |
| ↑ | 719,724 | TS2339 | Missing property | `FieldErrors.personalInsurance` |
| `src/features/registrations/components/PublicRegisterForm.tsx` | 79 | TS2345 | Argument mismatch | Same `TourAllowPrivateCarInput` issue |
| ↑ | 83 | TS2551 | Wrong property name | `personalInsuranceRequired` on participation |
| `lib/services/registrations.service.ts` | 3 | TS2305 | Missing export | `RegistrationParticipantMetadataDto` from `@repo/types` |

### Batch B — Tour mapper (2 errors)

| File | Ln | Code | Category |
|------|-----|------|----------|
| `lib/mappers/tour.mapper.ts` | 237 | TS2322 | `TourTripDetails` logistics shape vs `allowPrivateCar` helper input |
| ↑ | 245 | TS2353 | `accessLevel` not on `TourDto` |

### Batch C — Wizard runtime (6 errors)

| File | Ln | Code | Category |
|------|-----|------|----------|
| `src/features/tours/wizard/domain/ruleModelConverter.ts` | 164 | TS2322 | `"denali"` not valid `TourFormProfile` |
| `src/features/tours/wizard/denali/denaliWizardDraftContract.ts` | 62 | TS2694 | Zod namespace `z` export |
| ↑ | 92 | TS2322 | `DenaliCanonicalTourModel` category union |
| `src/features/tours/wizard/denali/rules/deriveDenaliTemplateSchema.ts` | 9 | TS6196 | Unused `DenaliRuleFieldDefinition` |
| ↑ | 40 | TS2552 | `DenaliTemplateSchemaModel` typo |
| `lib/validation/universal-validator.ts` | 117 | TS6133 | Unused `overlay` |
| ↑ | 178 | TS2345 | Partial template vs `TenantWizardTemplate` |

### Batch D — Wizard specs (24 errors) — file roll-up

| File | Count | Main categories |
|------|-------|-----------------|
| `denali/validation/denaliRuleValidation.spec.ts` | 4 | TS6133, TS2322 (`"denali"`) |
| `domain/mapDenaliWizardToCreateTourPayload.spec.ts` | 3 | TS2739 photos, TS2339 |
| `denali/denaliEditDraftBootstrap.spec.ts` | 2 | TS2345 serverBaseline mocks |
| `denali/denaliFormPathUtils.spec.ts` | 2 | TS2739 location lat/long |
| `denali/pickDenaliWizardDraftForRestore.spec.ts` | 2 | TS2322 `"denali"` |
| `resolveWorkspaceTourFormProfile.spec.ts` | 2 | TS2345 template mocks |
| `tourCreationPresetApply.spec.ts` | 2 | TS2322 missing `canonicalData` |
| `denali/rules/denaliWorkspaceFieldOverlay.spec.ts` | 1 | TS2322 |
| `denali/rules/integrity.spec.ts` | 1 | TS2322 |
| `denali/safeDraftHydration.spec.ts` | 1 | TS2322 |
| `denali/validation/denaliRuleAccess.spec.ts` | 1 | TS2322 |
| `denali/validation/denaliWizardPublishReadiness.spec.ts` | 1 | TS2353 `transport` key |
| `domain/mapDenaliWizardToDraftPayload.spec.ts` | 1 | TS2322 `tourType` undefined |
| `domain/ruleModelConverter.spec.ts` | 1 | TS2322 |
| `apply-wizard-draft-restore.spec.ts` | 1 | TS2741 `canonicalData` |
| `sources/loadWizardPrefill.spec.ts` | 1 | TS2322 |
| `resolveWorkspaceTourFormProfile.ts` | 1 | TS6133 |
| `scripts/generate-denali-wizard-config.ts` | 1 | TS6133 |

### Batch E — Tours UI (7 errors)

| File | Ln | Code | Category |
|------|-----|------|----------|
| `src/components/tours/DenaliTourEditForm.tsx` | 496 | TS2345 | Form path union |
| ↑ | 507 | TS2677 | Type predicate |
| ↑ | 640 | TS2322 | Alert/div props |
| `src/components/tours/wizard/DenaliCreateTourWizard.tsx` | 12,15 | TS6133 | Unused React types |
| `app/(app)/tours/[id]/workspace/DriversManagementTable.tsx` | 152 | TS2339 | i18n `cancel` key |
| `app/(app)/tours/[id]/workspace/tour-workspace-transport-tab.tsx` | 75 | TS2322 | Notify handler return type |
| `app/(app)/tours/[id]/workspace/build-tour-transport-roster.spec.ts` | 4 | TS6133 | Unused import |

### Batch F–I — Public / Content / BFF / Tests (15 errors)

See non-Golden table below.

---

## Non–Golden Path (15 errors, 6 files)

| File | Count | Categories | Notes |
|------|-------|------------|-------|
| `src/components/shared/quick-add/forms/DestinationQuickAddForm.tsx` | 6 | TS2339, TS7006, TS2322 | Regions hook returns object without `.data` |
| `tests/audit/denali-draft-contract.spec.ts` | 4 | TS7006 | Implicit `any` on parameters |
| `lib/api/bff-proxy.ts` | 2 | TS2345 | `BFF_CONFIG_MISSING` not in error code union |
| `src/features/content/components/ContentTextBlock.tsx` | 1 | TS2305 | Missing export from `@repo/shared-contracts` |
| `src/features/content/components/renderPageBlock.tsx` | 1 | TS2305 | Missing `ImageBlock` export |
| `src/features/public-site/components/PublicCatalogGrid.tsx` | 1 | TS2322 | `ErrorState` props |
| `src/features/public-site/components/PublicTourDetailView.tsx` | 2 | TS6133, TS2322 | Unused import + `ErrorState` props |

---

## Full file index (sorted by error count)

| Rank | File | Errors | Golden Path? |
|------|------|--------|--------------|
| 1 | `app/(app)/tours/[id]/register/register-for-tour-client.tsx` | 13 | Yes |
| 2 | `src/components/shared/quick-add/forms/DestinationQuickAddForm.tsx` | 6 | No |
| 3 | `src/features/tours/wizard/denali/validation/denaliRuleValidation.spec.ts` | 4 | Yes (spec) |
| 4 | `tests/audit/denali-draft-contract.spec.ts` | 4 | No |
| 5 | `src/components/tours/DenaliTourEditForm.tsx` | 3 | Yes |
| 5 | `src/features/tours/wizard/domain/mapDenaliWizardToCreateTourPayload.spec.ts` | 3 | Yes (spec) |
| … | (34 Golden + 6 non-Golden files total) | 80 | |
