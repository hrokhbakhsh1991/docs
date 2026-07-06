import {
  getWizardRulesModuleSync as getWizardRulesModuleSyncFromBindings,
  loadWizardRulesModule as loadWizardRulesModuleFromBindings,
  type WizardRulesModule,
} from "@/bootstrap/workspace-wizard-rules-bindings.generated";

export type DenaliWizardRulesModule = WizardRulesModule;

/**
 * Sync Denali rules for routes that already static-import the Denali plugin (create-tour, template).
 */
export function getDenaliWizardRulesModuleSync(): DenaliWizardRulesModule {
  return getWizardRulesModuleSyncFromBindings("denali");
}

/**
 * Lazy Denali wizard rules — sole web entry for evaluateFormRules (Phase 6.3).
 */
export function loadDenaliWizardRulesModule(): Promise<DenaliWizardRulesModule> {
  return loadWizardRulesModuleFromBindings("denali");
}
