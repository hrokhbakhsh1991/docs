import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import { listBootstrapWorkspacePlugins } from "./workspace-plugins";

const pluginById = new Map(
  listBootstrapWorkspacePlugins().map((plugin) => [plugin.id, plugin] as const),
);

/**
 * Resolves a workspace plugin by id from the bootstrap registry (starter only in Phase 3.3).
 */
export function resolveWorkspacePlugin(pluginId: string): WorkspacePlugin {
  const plugin = pluginById.get(pluginId);
  if (!plugin) {
    throw new Error(`WORKSPACE_PLUGIN_NOT_FOUND:${pluginId}`);
  }
  return plugin;
}
