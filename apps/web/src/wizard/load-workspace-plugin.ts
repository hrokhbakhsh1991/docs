import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

/**
 * Dynamic plugin loader — async boundary for future host-based resolution (Phase 3.3).
 */
export async function loadWorkspacePluginById(pluginId: string): Promise<WorkspacePlugin> {
  const { resolveWorkspacePlugin } = await import("../bootstrap/workspace-plugin-registry");
  return resolveWorkspacePlugin(pluginId);
}
