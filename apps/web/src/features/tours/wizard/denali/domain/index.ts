/**
 * Denali Domain Façade
 *
 * Central entry point for business logic, validation rules, and schema accessors
 * related to the Denali wizard feature. UI components should import from here
 * instead of internal validation/logic modules.
 */

// Validation & Schemas
export {
  getDenaliWizardSubmitIssues,
  getDenaliWizardStepIssues,
  validateDenaliWizardForm,
  denaliTourCreateSchema,
} from "../validation/denaliWizardFormZod";

// Rule Access & Visibility
export {
  getDenaliWizardVisibleSteps,
  resolveDenaliRuleSetFromTemplate,
  isDenaliStepVisible,
  isDenaliStepVisibleInModel,
} from "../validation/denaliRuleAccess";

// Business Logic & Sanitization
export {
  normalizeDenaliWizardForm,
  prepareDenaliWizardFormForSubmit,
} from "../validation/denaliRuleAccess";

export { denaliFormSanitize } from "../denaliFormSanitize";
export { denaliGearSelection } from "../denaliGearSelection";
export { denaliCancellationPolicy } from "../denaliCancellationPolicy";
