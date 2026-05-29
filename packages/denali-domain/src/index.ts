/** Layout */
export {
  denaliWizardSteps,
  getDenaliWizardSteps,
  type DenaliCreateWizardStepId,
} from "./layout/stepIds";
export {
  DENALI_CATEGORY_ENUM,
  isDenaliCategoryEnum,
  migrateLegacyEquipmentCategory,
  normalizeCompatibleCategories,
  type DenaliCategoryEnum,
} from "./layout/denaliCategoryEnum";

/** Draft sync */
export * from "./draft/index";

/** Registry */
export {
  DENALI_FIELD_DEFINITIONS,
  type DenaliFieldDefinition,
  type DenaliZodFieldKind,
} from "./registry/denaliFieldRegistryData";
export { DENALI_FIELD_REGISTRY } from "./registry/DenaliFieldRegistry";
export type {
  DenaliContextualRule,
  DenaliFieldKind,
  DenaliFieldWireProjection,
  DenaliStructuralInvariant,
  DenaliGlobalStructuralInvariant,
} from "./registry/DenaliFieldRegistry.types";
export {
  getDenaliFieldRegistryByStep,
  isDenaliAsyncAssetCanonicalPath,
  listDenaliRegistryCanonicalPaths,
} from "./registry/DenaliFieldRegistry";
export { DENALI_GLOBAL_STRUCTURAL_INVARIANTS } from "./registry/denaliGlobalStructuralInvariants";
export {
  buildDenaliRuleSetFromRegistry,
  buildDenaliCanonicalMapFromRegistry,
  collectGeneratedArtifactSyncErrors,
} from "./registry/denaliRegistryCodegen";

/** Schemas */
export type { DenaliCreateTourWizardForm } from "./schemas/denaliCore.schema";
export {
  buildDenaliTourCreateDefaultValues,
  buildDenaliTourCreateTestValues,
  denaliBasicInfoSchema,
  denaliPhotosSchema,
  denaliProgramNatureSchema,
  denaliTripDetailsMetricsSchema,
  denaliTripDetailsOverviewCoreSchema,
  applyDenaliCoreSchemaRefinements,
  DENALI_WIZARD_TEST_DESTINATION_ID,
  DENALI_WIZARD_TEST_THEME_ID,
} from "./schemas/denaliCore.schema";
export { denaliTourCreateBaseSchema } from "./schemas/denaliTourCreateBaseSchema";
export { denaliCanonicalTourSchema } from "./schemas/denaliCanonicalTourSchema.unified";

/** Rules */
export * from "./rules/denaliRuleModel";
export * from "./rules/core";
export {
  deriveDenaliTemplateSchema,
  listDenaliTemplateCanonicalFieldPaths,
  DENALI_TEMPLATE_SCHEMA,
} from "./rules/deriveDenaliTemplateSchema";
export {
  parseFieldRulesOverlay,
  applyOverlayToRuleSet,
  resolveDenaliRuleSetFromOverlay,
  type FieldRuleOverlayPatch,
} from "./rules/templateOverlay";
export {
  evaluateDenaliContextualVisibility,
  getDenaliUIFromForm,
  getDenaliUIFromCanonical,
  isDenaliFieldVisibleOnStep,
  isDenaliFieldRequiredOnStep,
  isDenaliFieldVisibleInModel,
  isDenaliFieldRequiredInModel,
  isVisible,
  isRequired,
  type DenaliUIContextOptions,
} from "./rules/denaliUIAdapter";

/** Normalize */
export * from "./normalize/index";
export {
  applyDenaliInvariantState,
  prepareDenaliWizardFormForSubmit,
} from "./normalize/invariantState";
export { applyDenaliStructuralInvariants, getDenaliSafeFormState } from "./normalize/structuralInvariants";

/** Adapters */
export {
  denaliFormToCanonical,
  denaliCanonicalToForm,
  safeDenaliFormToCanonical,
  mergeDenaliCanonicalPartial,
  type DenaliCanonicalPartial,
} from "./adapters/denaliCanonicalFormAdapter";
export {
  tryHydrateCanonicalTemplate,
  type HydratedDenaliWizardForm,
} from "./adapters/canonicalTemplateHydration";
export { readDenaliCanonicalBasics, patchDenaliCanonicalBasics } from "./adapters/canonical-basics";
export { finalizeDenaliWizardHydration } from "./adapters/denaliFormHydration";
export {
  getDenaliFormPathValue,
  setDenaliFormPathValue,
} from "./adapters/denaliFormPathUtils";
export type { TourWizardPrefillMeta } from "./adapters/tourWizardPrefillMeta";

/** Validation */
export {
  getDenaliWizardSubmitIssues,
  getDenaliWizardStepIssues,
  validateDenaliWizardForm,
  denaliTourCreateFormSchema,
} from "./validation/denaliWizardFormZod";
export {
  safeParseDenaliCanonicalFromWizardForm,
  parseDenaliCanonicalFromWizardForm,
} from "./validation/safeParseCanonical";
export { resolvePublishReadinessFormPath } from "./validation/publishReadinessPathResolver";
export type { DenaliWizardPublishReadinessIssue } from "./validation/publishReadinessTypes";
export { collectDenaliPublishReadinessRuleIssues } from "./validation/publishReadinessRules";
export {
  DENALI_PUBLISH_READINESS_BLOCKING_CODES,
  DENALI_PUBLISH_READINESS_PATH_FIXTURES,
  publishReadinessIssueHasResolvablePath,
} from "./validation/denaliPublishReadinessIssueCodes";
