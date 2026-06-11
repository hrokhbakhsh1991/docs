import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import { loadWorkspacePluginByIdFromRegistry } from "../bootstrap/workspace-plugin-loaders.generated";

/**
 * Dynamic plugin loader — async boundary for host/tenant plugin resolution (Phase 3.3 / 6.5 / 7.3).
 * Product workspace plugins are dynamically imported so starter routes stay lean.
 */
export async function loadWorkspacePluginById(pluginId: string): Promise<WorkspacePlugin> {
  return loadWorkspacePluginByIdFromRegistry(pluginId);
}
