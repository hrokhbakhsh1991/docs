import {
  DEFAULT_WORKSPACE_TYPE_BINDINGS,
  resolveWorkspacePluginIdForType,
  type WorkspacePlugin,
  type WorkspaceTypeId,
} from "@app-tour/workspace-sdk";

import { loadApiWorkspacePluginByIdFromManifest } from "./workspace-plugin-registry.generated";

/**
 * Resolves {@link WorkspacePlugin} from tenant `workspace_type` (RULE-005).
 * Non-starter types without binding throw WORKSPACE_PLUGIN_NOT_BOUND (Phase 6 workspace plugins).
 * P4.2 — loads one allowlisted plugin via dynamic import (no eager all-plugin Map).
 */
export async function resolveWorkspacePluginForType(workspaceType: string): Promise<WorkspacePlugin> {
  const pluginId = resolveWorkspacePluginIdForType(
    workspaceType as WorkspaceTypeId,
    DEFAULT_WORKSPACE_TYPE_BINDINGS
  );
  if (pluginId === null) {
    throw new Error(`WORKSPACE_PLUGIN_NOT_BOUND:${workspaceType}`);
  }
  try {
    return await loadApiWorkspacePluginByIdFromManifest(pluginId);
  } catch {
    throw new Error(`WORKSPACE_PLUGIN_NOT_FOUND:${pluginId}`);
  }
}
