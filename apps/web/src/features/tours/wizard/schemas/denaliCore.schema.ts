/**
 * Denali wizard — re-exports from @repo/denali-domain (types, defaults, normalize).
 */
export type { DenaliCreateTourWizardForm } from "@repo/denali-domain";

export {
  denaliBasicInfoSchema,
  denaliPhotosSchema,
  denaliProgramNatureSchema,
  denaliTripDetailsMetricsSchema,
  denaliTripDetailsOverviewCoreSchema,
  applyDenaliCoreSchemaRefinements,
  buildDenaliTourCreateDefaultValues,
  buildDenaliTourCreateTestValues,
  normalizeDenaliFormPatch,
  normalizeDenaliWizardForm,
  DENALI_WIZARD_TEST_DESTINATION_ID,
  DENALI_WIZARD_TEST_THEME_ID,
} from "@repo/denali-domain";
