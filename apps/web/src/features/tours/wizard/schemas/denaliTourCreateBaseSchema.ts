// DEPRECATED: DO NOT EDIT Zod field definitions here — AUTO-GENERATED from the registry.
// Edit denaliFieldRegistryData.ts, then: pnpm --filter web generate:denali-wizard
// This file only re-exports the composed generated schema.
/**
 * @deprecated Removed from submit / wizard / mapper runtime pipeline (Phase 5).
 * Use {@link ./denaliCanonicalTourSchema.unified.ts} via {@link ../denali/validation/denaliSubmitValidation.ts}.
 *
 * Zod object shape is generated from domain slices — see denaliCore/Logistics/Pricing.schema.ts.
 * Run `pnpm --filter web generate:denali-wizard` after registry edits.
 *
 * Retained for unit tests only (not product submit/resolver paths).
 */

export {
  denaliTourCreateBaseSchema,
  type DenaliCreateTourWizardForm,
} from "./denaliTourCreateBaseSchema.generated";

export {
  buildDenaliTourCreateDefaultValues,
  buildDenaliTourCreateTestValues,
  DENALI_WIZARD_TEST_DESTINATION_ID,
  DENALI_WIZARD_TEST_THEME_ID,
} from "./denaliCore.schema";
