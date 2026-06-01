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

/** Catalog clone / reference registry */
export {
  CatalogRegistry,
  catalogRegistry,
  GLOBAL_CATALOG_ARRAY_FIELD_NAMES,
  OVERVIEW_TOUR_INSTANCE_PIN_FIELD_NAMES,
  type CatalogReferenceKey,
  type CatalogRegistryResolveInput,
  type GlobalCatalogReferenceKey,
  type TourInstanceReferenceKey,
} from "./catalog/catalog-registry";
export {
  cloneTripDetailsWithRemap,
  type CloneTripDetailsResult,
  type CloneTripDetailsWithRemapOptions,
  type DenaliTripDetailsCloneSource,
} from "./catalog/clone-trip-details-with-remap";
export {
  copyCatalogReferenceArray,
  remintLocation,
  remintPhoto,
  safeRemintTripDetailsRegistryWalk,
  createRegistryWalkContext,
  type RegistryWalkContext,
} from "./catalog/safe-remint-registry-walk";
export {
  buildDenaliClonePresetFromTripDetails,
  readDenaliClonePresetFormPath,
  type BuildDenaliClonePresetOptions,
} from "./catalog/clone-storage-preset-walker";

/** Draft sync */
export * from "./draft/index";

/** Registry */
export {
  DENALI_FIELD_DEFINITIONS,
  type DenaliFieldDefinition,
  type DenaliSettingsSurface,
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
  type DenaliFieldRegistryEntry,
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
export {
  assertDenaliLegacySchemaAllowed,
  type DenaliLegacySchemaSite,
} from "./schemas/denaliLegacySchemaGuard";
export { DenaliLegacySchemaForbiddenError } from "./schemas/denaliLegacySchemaForbiddenError";

/** Rules */
export * from "./rules/denaliRuleModel";
export * from "./rules/core";
export {
  deriveDenaliTemplateSchema,
  listDenaliTemplateCanonicalFieldPaths,
  DENALI_TEMPLATE_SCHEMA,
} from "./rules/deriveDenaliTemplateSchema";
export { listDenaliTemplateStorageFieldPaths } from "./rules/listDenaliTemplateStorageFieldPaths";
export {
  DENALI_MODERN_SETTINGS_OVERLAY_STORAGE_PATHS,
  listDenaliSettingsOverlayStoragePaths,
} from "./rules/listDenaliSettingsOverlayStoragePaths";
export {
  getDenaliSettingsOverlayFieldHints,
  type DenaliOverlayContextualHintKey,
  type DenaliOverlayFieldHint,
} from "./rules/denaliOverlayFieldHints";
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
  isDenaliWizardTourTypeSelected,
  createInitialDenaliCanonicalModel,
  canonicalDurationToBasicsDuration,
  basicsDurationToCanonicalDuration,
  applyCanonicalMvpToForm,
  denaliCanonicalFormSetValueOptions,
  DENALI_QUIET_FORM_SET_VALUE_OPTIONS,
  DENALI_USER_FORM_SET_VALUE_OPTIONS,
  DENALI_QUIET_FORM_RESET_OPTIONS,
  type DenaliCanonicalPartial,
  type ApplyCanonicalMvpToFormOptions,
  type DenaliCanonicalFormEngineStatus,
} from "./adapters/denaliCanonicalFormAdapter";
export {
  denaliCanonicalOptionalTrimmedString,
  sanitizeDenaliCanonicalModel,
} from "./adapters/denaliCanonicalSchemaRegistry";
export {
  tryHydrateCanonicalTemplate,
  validateCanonicalTemplateData,
  type HydratedDenaliWizardForm,
} from "./adapters/canonicalTemplateHydration";
export { readDenaliCanonicalBasics, patchDenaliCanonicalBasics } from "./adapters/canonical-basics";
export { finalizeDenaliWizardHydration } from "./adapters/denaliFormHydration";
export {
  buildDenaliCreateTourPayloadProjection,
  buildDenaliStagingShellProjection,
  buildDenaliSubmitItinerarySlice,
  denaliDayPlansToSegmentActivities,
  denaliTourKindToApiTourType,
  splitIsoDateTime,
  type BuildDenaliCreateTourPayloadProjectionOptions,
  type DenaliCreateTourPayloadProjectionMode,
} from "./projection/buildDenaliCreateTourPayloadProjection";
export type { DenaliCreateTourPayloadProjection } from "./projection/wizardMapperHelpers";
export {
  DenaliTemplateOrchestratorFactory,
  denaliTemplateOrchestratorFactory,
} from "./rules/factory/DenaliTemplateOrchestratorFactory";
export type {
  DenaliTemplateOrchestratorContract,
  OrchestrationOptions,
  OrchestrationOutput,
  WorkspaceTemplatePayload,
} from "./rules/factory/denaliTemplateOrchestrator.types";
export {
  getDenaliFormPathValue,
  setDenaliFormPathValue,
} from "./adapters/denaliFormPathUtils";
export type { TourWizardPrefillMeta } from "./adapters/tourWizardPrefillMeta";

/** Validation */
export {
  denaliTourCreateSchemaRuleAware,
  getDenaliWizardSubmitIssues,
  getDenaliWizardStepIssues,
  parseDenaliTourCreateForm,
  validateDenaliWizardForm,
  denaliTourCreateFormSchema,
  type DenaliWizardValidationOptions,
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
