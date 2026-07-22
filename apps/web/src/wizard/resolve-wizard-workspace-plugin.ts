import {
  DEFAULT_WIZARD_PLUGIN_ID,
  getWorkspacePluginFromDraftShell,
} from "@/wizard/draft-shell-runtime";
import { loadWorkspacePluginByIdFromRegistry } from "@/bootstrap/workspace-plugin-loaders.generated";

/**
 * Sync wizard plugin via draft-shell generated surface (extended-create trunk today).
 * Prefer injecting a registry-loaded plugin (Wave I.9 create / Wave B.c flat-edit).
 * @deprecated Prefer {@link loadWizardWorkspacePlugin}; remove when zero callers remain.
 */
export function resolveWizardSyncWorkspacePlugin() {
  return getWorkspacePluginFromDraftShell();
}

/**
 * Allowlisted dynamic import — same registry as admin plugin loaders.
 * Wizard create/flat-edit pass session `pluginId` (Wave I.6).
 * Default remains the extended-create trunk id for stray/test callers only.
 */
export async function loadWizardWorkspacePlugin(
  pluginId: string = DEFAULT_WIZARD_PLUGIN_ID
) {
  return loadWorkspacePluginByIdFromRegistry(pluginId);
}
