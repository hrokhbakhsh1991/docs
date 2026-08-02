import {
  ensureWizardHostReady,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

import { loadWorkspacePluginByIdFromRegistry } from "@/bootstrap/workspace-plugin-loaders.generated";

/**
 * Operator create/flat-edit warm — Build-time Capability Host.
 * Load plugin via manifest codegen registry, then await wizardHost ensureReady.
 * No product binder names, product facades, or per-surface warm helpers in the shell.
 */
export async function warmOperatorWizardShell(pluginId: string): Promise<WorkspacePlugin> {
  const plugin = await loadWorkspacePluginByIdFromRegistry(pluginId);
  await ensureWizardHostReady(plugin);
  return plugin;
}
