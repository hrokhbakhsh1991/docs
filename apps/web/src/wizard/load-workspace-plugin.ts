import type { WorkspacePlugin } from "@app-tour/workspace-sdk";
import { DENALI_WORKSPACE_PLUGIN_ID } from "@app-tour/workspace-sdk";

import { loadDenaliWorkspacePlugin } from "../bootstrap/lazy-denali-plugin";

/**
 * Dynamic plugin loader — async boundary for host/tenant plugin resolution (Phase 3.3 / 6.5).
 */
export async function loadWorkspacePluginById(pluginId: string): Promise<WorkspacePlugin> {
  if (pluginId === DENALI_WORKSPACE_PLUGIN_ID) {
    return loadDenaliWorkspacePlugin();
  }
  const { resolveWorkspacePlugin } = await import("../bootstrap/workspace-plugin-registry");
  return resolveWorkspacePlugin(pluginId);
}
