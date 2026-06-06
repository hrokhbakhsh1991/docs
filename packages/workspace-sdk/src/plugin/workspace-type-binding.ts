import type { WorkspacePluginId } from "./workspace-plugin-id";
import { DENALI_WORKSPACE_PLUGIN_ID, STARTER_WORKSPACE_PLUGIN_ID } from "./workspace-plugin-id";
import type { WorkspaceTypeId } from "./workspace-type";
import { DENALI_WORKSPACE_TYPE, STARTER_WORKSPACE_TYPE } from "./workspace-type";

export interface WorkspaceTypeBinding {
  readonly workspaceType: WorkspaceTypeId;
  readonly pluginId: WorkspacePluginId;
}

export const DEFAULT_WORKSPACE_TYPE_BINDINGS: readonly WorkspaceTypeBinding[] = [
  { workspaceType: STARTER_WORKSPACE_TYPE, pluginId: STARTER_WORKSPACE_PLUGIN_ID },
  { workspaceType: DENALI_WORKSPACE_TYPE, pluginId: DENALI_WORKSPACE_PLUGIN_ID },
];

export function resolveWorkspacePluginIdForType(
  workspaceType: WorkspaceTypeId,
  bindings: readonly WorkspaceTypeBinding[]
): WorkspacePluginId | null {
  return bindings.find((b) => b.workspaceType === workspaceType)?.pluginId ?? null;
}
