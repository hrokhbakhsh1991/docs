/**
 * Public barrel for the tours feature. External consumers must import from here only
 * (`@/features/tours`), not from nested paths under `features/tours/**`.
 *
 * Test-only exports live in `./testing/public-test-api` (not re-exported — avoids node: builtins in client bundles).
 */
export { DenaliGatheringPointsWidget } from "./wizard/denali/components/DenaliGatheringPointsWidget";
export type { DenaliGatheringPointsWidgetProps } from "./wizard/denali/components/DenaliGatheringPointsWidget";

export { buildDenaliWizardDiagnosticReport } from "./wizard/denali/denaliWizardDiagnostic";

export {
  DENALI_FIELD_REGISTRY,
  isDenaliFieldInMatrixCell,
} from "./wizard/denali/registry/DenaliFieldRegistry";
export {
  DENALI_FIELD_DEFINITIONS,
  type DenaliFieldDefinition,
  type DenaliZodFieldKind,
} from "./wizard/denali/registry/denaliFieldRegistryData";
export {
  buildDenaliCanonicalMapFromRegistry,
  buildDenaliConditionallyRequiredCanonicalPathsFromRegistry,
  buildDenaliRuleSetFromRegistry,
  collectGeneratedArtifactSyncErrors,
} from "./wizard/denali/registry/denaliRegistryCodegen";
export { DENALI_MATRIX_CELLS } from "./wizard/denali/registry/denaliRuleMatrixRecipes";

export { DENALI_CANONICAL_TO_FORM_PATH_MAP } from "./wizard/denali/rules/generated/denaliCanonicalPathMap.generated";
export { listDenaliRuleFieldPaths } from "./wizard/denali/rules/denaliRuleModel";
export {
  DENALI_RULE_MODEL_CATEGORIES,
  DENALI_RULE_MODEL_DURATIONS,
  type DenaliRuleSet,
} from "./wizard/denali/rules/denaliRuleModel.types";
export { isDenaliFieldVisibleInModel } from "./wizard/denali/rules/denaliUIAdapter";

export { applyDenaliStructuralInvariants } from "./wizard/denali/validation/denaliInvariantEngine";
export { clearDenaliNonVisibleFormValues } from "./wizard/denali/validation/denaliRuleAccess";
export { parseDenaliTourCreateForm } from "./wizard/denali/validation/denaliWizardFormZod";

export { presetDefaultsToDenaliFormPatch } from "./wizard/presetDefaultsToDenaliFormPatch";
export type { TourCreateWizardStepId } from "./wizard/stepConfig";
export { wizardSteps } from "./wizard/stepConfig";

export type {
  ValidationIssue,
  ValidationIssueCode,
  ValidationResult,
} from "./wizard/profileRules/validation";

export {
  resolveTourFormProfileForTourFormValues,
  type ThemeRowForProfile,
} from "./wizard/tourWizardProfileResolve";

export type { TenantWizardTemplate } from "./wizard/template/tenant-wizard-template.types";
export { DATA_LEGACY_PROFILE_MISMATCH_MESSAGE } from "./wizard/validation/data-legacy-error";
export { isDenaliStructuredTemplate } from "./wizard/validation/denali-template-shape";
export { StrictProfileValidator } from "./wizard/validation/strict-profile-validator";

export {
  TOUR_TITLE_MAX_LENGTH,
  TOUR_TITLE_MIN_LENGTH,
} from "./models/tours-new-validation-messages";
export { denaliGearItemSchema } from "./wizard/schemas/denaliGearItemSchema";
export {
  denaliCanonicalItineraryDayRowSchema,
  optionalApproximateReturnTimeSchema,
} from "./wizard/schemas/denaliItineraryDaySchema";
export { denaliLocationDataSchema } from "./wizard/schemas/denaliLocationDataSchema";
export { denaliCanonicalTourSchema } from "./wizard/schemas/denaliCanonicalTourSchema.unified";
export { denaliTourCreateBaseSchema } from "./wizard/schemas/denaliTourCreateBaseSchema";
