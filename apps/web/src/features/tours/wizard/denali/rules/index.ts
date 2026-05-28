/**
 * Denali rules façade — rule models, UI visibility, canonical mapping, form evaluation.
 */

export * from "./core";

export {
  evaluateFormFieldRule,
  evaluateFormRules,
  type EvaluatedFormFieldRule,
  type EvaluateFormFieldRuleResult,
} from "./evaluateFormRules";

export {
  areDenaliFieldPathsVisibleOnStep,
  deriveDenaliUIFieldMetadata,
  getDenaliUIAdapterMetadata,
  getDenaliUIFromCanonical,
  getDenaliUIFromForm,
  getHiddenFieldPathsFromModel,
  hiddenFields,
  isDenaliDurationAllowed,
  isDenaliFieldRequiredInModel,
  isDenaliFieldRequiredOnStep,
  isDenaliFieldVisibleOnStep,
  isRequired,
  isVisible,
  requiredFields,
  visibleFields,
  type DenaliCanonicalUIContext,
  type DenaliUIAdapterInput,
  type DenaliUIFieldMetadata,
} from "./denaliUIAdapter";

/** @deprecated Use {@link isDenaliFieldVisibleOnStep} */
export { isVisible as isDenaliFieldVisible } from "./denaliUIAdapter";
