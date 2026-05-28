/**
 * Rule-engine data access (visibility / required / step sections / form normalize).
 * Implementation lives in {@link @/features/tours/domain/denali-rules} to avoid cycles with the invariant engine.
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
} from "@/features/tours/domain/denali-rules";

export {
  isDenaliFieldRequiredInModel,
  isDenaliFieldRequiredOnStep,
  isDenaliFieldVisibleInModel,
  isDenaliFieldVisibleOnStep,
} from "../rules/denaliUIAdapter";
