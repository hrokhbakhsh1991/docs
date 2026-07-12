import { getWizardRulesModuleSyncForWorkspace } from "./workspace-wizard-rules-bindings.generated.ts";

export {
  getWizardRulesModuleSyncForWorkspace,
  type WorkspaceWizardRulesModuleSync,
} from "./workspace-wizard-rules-bindings.generated.ts";

/** @deprecated Use getWizardRulesModuleSyncForWorkspace(workspaceType). */
export function getDenaliWizardRulesModuleSync() {
  return getWizardRulesModuleSyncForWorkspace("denali");
}
