/**
 * Denali validation façade — schemas, rule access, submit/publish guards.
 */

export {
  buildDenaliTourCreateDefaultValues,
  denaliTourCreateFormSchema,
  denaliTourCreateSchema,
  denaliTourCreateSchemaRuleAware,
  getDenaliWizardStepIssues,
  getDenaliWizardSubmitIssues,
  parseDenaliTourCreateForm,
  validateDenaliWizardForm,
  type DenaliWizardValidationOptions,
} from "./denaliWizardFormZod";

export {
  clearDenaliNonVisibleFormValues,
  DENALI_RAIL_TEST_FORCE_STEP_IDS,
  DENALI_STRUCTURAL_RAIL_STEPS,
  getDenaliStepPickShape,
  getDenaliWizardVisibleSteps,
  hasDenaliWizardClassification,
  isDenaliStepVisible,
  isDenaliStepVisibleInModel,
  normalizeDenaliFormPatch,
  normalizeDenaliWizardForm,
  prepareDenaliWizardFormForSubmit,
  resolveDenaliRuleModelFromForm,
  resolveDenaliRuleSetFromTemplate,
  stripRuleHiddenFieldValues,
  withDenaliWizardRailTestingOverrides,
  type DenaliRuleSet,
} from "./denaliRuleAccess";

export {
  parseDenaliCanonicalFromWizardForm,
  safeParseDenaliCanonicalFromWizardForm,
} from "./denaliSubmitValidation";

// Test submit helpers: @/features/tours/testing/denaliSubmitTestHelpers (not exported here — client-safe)

export {
  getDenaliWizardPublishReadinessIssues,
  getDenaliWizardPublishReadinessIssuesForTargetStatus,
  isDenaliWizardReadyForOpenPublish,
  type DenaliWizardPublishReadinessIssue,
} from "./denaliWizardPublishReadiness";

export {
  applyDenaliInvariantState,
  applyDenaliStructuralInvariants,
  getDenaliSafeFormState,
} from "./denaliInvariantEngine";

export {
  evaluateSyncGuard,
  type SyncGuardIssue,
  type SyncGuardIssueCode,
  type SyncGuardResult,
  type SyncGuardSnapshot,
} from "./syncGuard";

export {
  handleStatusChange,
  type HandleStatusChangeReason,
  type HandleStatusChangeResult,
  type WizardPublishStatus,
} from "./handleStatusChange";

export {
  hydrateBackendErrorsToWizardTargets,
  type BackendValidationEnvelope,
  type BackendValidationFieldError,
  type DenaliWizardStepId,
  type HydratedWizardValidationIssue,
} from "./hydrateBackendErrorsToWizardTargets";
