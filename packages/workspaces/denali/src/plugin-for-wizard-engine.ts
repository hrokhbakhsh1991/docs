import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

/**
 * Operator/marketing callable surfaces are not plain JSON — strip before
 * `PlatformWizardEngine.create` (workspace-sdk ingress rejects functions).
 */
export function denaliPluginForWizardEngine(plugin: WorkspacePlugin): WorkspacePlugin {
  const {
    tourList: _tourList,
    tourClone: _tourClone,
    publicCatalog: _publicCatalog,
    wizardHost: _wizardHost,
    draftTombstone: _draftTombstone,
    ...wizardPlugin
  } = plugin;
  return wizardPlugin as WorkspacePlugin;
}
