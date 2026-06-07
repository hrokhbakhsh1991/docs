import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
import { DENALI_WORKSPACE_PLUGIN_ID, URBAN_WORKSPACE_PLUGIN_ID } from "@app-tour/workspace-sdk";

/**
 * Dynamic plugin loader — async boundary for host/tenant plugin resolution (Phase 3.3 / 6.5 / 7.3).
 * Product workspace plugins are dynamically imported so starter routes stay lean.
 */
export async function loadWorkspacePluginById(pluginId: string): Promise<WorkspacePlugin> {
  if (pluginId === DENALI_WORKSPACE_PLUGIN_ID) {
    const { loadDenaliWorkspacePlugin } = await import("../bootstrap/lazy-denali-plugin");
    return loadDenaliWorkspacePlugin();
  }
  if (pluginId === URBAN_WORKSPACE_PLUGIN_ID) {
    const { loadUrbanWorkspacePlugin } = await import("../bootstrap/lazy-urban-plugin");
    return loadUrbanWorkspacePlugin();
  }
  const { resolveWorkspacePlugin } = await import("../bootstrap/workspace-plugin-registry");
  return resolveWorkspacePlugin(pluginId);
}
