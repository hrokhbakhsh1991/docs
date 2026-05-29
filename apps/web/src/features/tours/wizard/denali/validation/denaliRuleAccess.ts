/**
 * Rule-engine data access — re-exported from @repo/denali-domain.
 */
export {
  DENALI_RAIL_TEST_FORCE_STEP_IDS,
  DENALI_STRUCTURAL_RAIL_STEPS,
  clearDenaliNonVisibleFormValues,
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
} from "@repo/denali-domain";

export {
  isDenaliFieldRequiredInModel,
  isDenaliFieldRequiredOnStep,
  isDenaliFieldVisibleInModel,
  isDenaliFieldVisibleOnStep,
} from "@repo/denali-domain";
