/**
 * Denali Application Façade
 *
 * Central entry point for orchestration logic, hooks, and application services
 * related to the Denali wizard feature. UI components should import from here.
 */

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

// Domain Façade Re-export (Application layer exposes Domain logic to UI)
export * from "../domain";
