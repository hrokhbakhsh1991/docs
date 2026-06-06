import {
  DEFAULT_WORKSPACE_TYPE_BINDINGS,
  resolveWorkspacePluginIdForType,
  type WorkspacePlugin,
  type WorkspaceTypeId,
} from "@app-tour/workspace-sdk";

import { listApiWorkspacePlugins } from "./workspace-plugins";

const pluginById = new Map(
  listApiWorkspacePlugins().map((plugin) => [plugin.id, plugin] as const),
);

/**
 * Resolves {@link WorkspacePlugin} from tenant `workspace_type` (RULE-005).
 * Non-starter types without binding throw WORKSPACE_PLUGIN_NOT_BOUND (Phase 6 workspace plugins).
 */
export function resolveWorkspacePluginForType(workspaceType: string): WorkspacePlugin {
  const pluginId = resolveWorkspacePluginIdForType(
    workspaceType as WorkspaceTypeId,
    DEFAULT_WORKSPACE_TYPE_BINDINGS,
  );
  if (pluginId === null) {
    throw new Error(`WORKSPACE_PLUGIN_NOT_BOUND:${workspaceType}`);
  }
  const plugin = pluginById.get(pluginId);
  if (plugin === undefined) {
    throw new Error(`WORKSPACE_PLUGIN_NOT_FOUND:${pluginId}`);
  }
  return plugin;
}
