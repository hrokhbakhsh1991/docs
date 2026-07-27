import { loadWorkspacePluginByIdFromRegistry } from "@/bootstrap/workspace-plugin-loaders.generated";

/**
 * Allowlisted dynamic import — same registry as admin plugin loaders.
 * Wizard create/flat-edit must pass session `pluginId` (Wave I.6).
 */
export async function loadWizardWorkspacePlugin(pluginId: string) {
  return loadWorkspacePluginByIdFromRegistry(pluginId);
}
