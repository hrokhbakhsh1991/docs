/**
 * Denali Application Façade
 *
 * Central entry point for orchestration logic, hooks, and application services
 * related to the Denali wizard feature. UI components should import from here.
 */

export type {
  DenaliWizardHeaderPlugin,
  DenaliWizardHeaderPluginContext,
  DenaliWizardHeaderPluginFormMethods,
} from "./denaliWizardHeaderPlugin";

// Orchestration Context & Providers
export {
  DenaliCanonicalContext,
  DenaliCanonicalProvider,
  useDenaliCanonical,
  useDenaliCanonicalOptional,
} from "../DenaliCanonicalContext";

// Orchestration Logic
export {
  calculateDenaliWizardCompletionScore,
  calculateCompletionPercentage,
} from "../denaliWizardCompletion";
export { logDenaliWizardDiagnosticReport } from "../denaliWizardDiagnostic";

// Application Hooks
export { useDenaliStepFieldRules } from "../hooks/useDenaliStepFieldRules";
export { useDenaliFieldRules } from "@/features/tours/denali/hooks/useDenaliFieldRules";
export { useDenaliPublishReadiness } from "../hooks/useDenaliPublishReadiness";
export { useDenaliWizardFormSnapshot } from "../hooks/useDenaliWizardFormSnapshot";
export { useDenaliCanonicalModel } from "../hooks/useDenaliCanonicalModel";
export { useWizardStateGuard } from "../hooks/useWizardStateGuard";
export { useDenaliEditRuleSync } from "../hooks/useDenaliEditRuleSync";
export { useDenaliCanonicalValue } from "../hooks/useDenaliCanonicalValue";
export { useDenaliDestinationQuickAdd } from "../hooks/useDenaliDestinationQuickAdd";
export { useDenaliEquipmentQuickAdd } from "../hooks/useDenaliEquipmentQuickAdd";
export { useDebouncedLocationSearch } from "../hooks/useDebouncedLocationSearch";

// Rule UI Adapters (Application Layer logic for UI)
export {
  evaluateDenaliContextualVisibility,
  getDenaliUIFromForm,
  getDenaliUIFromCanonical,
} from "../rules/denaliUIAdapter";
export {
  isDenaliMountaineeringTourType,
  isPeakExperienceVisible,
} from "../rules/predicates";

// Domain package façade (registry, rules, normalize, adapters)
export {
  denaliRuleSet,
  DENALI_FIELD_REGISTRY,
  DENALI_FIELD_DEFINITIONS,
  deriveDenaliTemplateSchema,
  denaliFormToCanonical,
  denaliCanonicalToForm,
} from "@/features/tours/application/denali";

// Canonical basics (wizard-local barrel)
export {
  patchDenaliCanonicalBasics,
  readDenaliCanonicalBasics,
} from "../domain";

// Form validation & rule access (deep paths — not ../validation barrel)
export {
  getDenaliWizardStepIssues,
  getDenaliWizardSubmitIssues,
  validateDenaliWizardForm,
} from "../validation/denaliWizardFormZod";
export {
  getDenaliWizardVisibleSteps,
  isDenaliStepVisible,
  isDenaliStepVisibleInModel,
  normalizeDenaliWizardForm,
  prepareDenaliWizardFormForSubmit,
  resolveDenaliRuleSetFromTemplate,
} from "../validation/denaliRuleAccess";
export { sanitizeDenaliFormPatch } from "../denaliFormSanitize";
export {
  gearCatalogIdsToGearItems,
  normalizeGearItems,
  removeGearItem,
  splitGearByRequired,
  upsertGearItem,
} from "../denaliGearSelection";
export { buildDenaliCancellationPolicyText } from "../denaliCancellationPolicy";

// Publish / sync guards (deep paths — not ../validation barrel)
export {
  getDenaliWizardPublishReadinessIssues,
  isDenaliWizardReadyForOpenPublish,
} from "../validation/denaliWizardPublishReadiness";
export { safeParseDenaliCanonicalFromWizardForm } from "../validation/denaliSubmitValidation";
export { handleStatusChange } from "../validation/handleStatusChange";
export { hydrateBackendErrorsToWizardTargets } from "../validation/hydrateBackendErrorsToWizardTargets";
