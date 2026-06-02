import type { WorkspacePluginId } from "./workspace-plugin-id";
import { STARTER_WORKSPACE_PLUGIN_ID } from "./workspace-plugin-id";
import type { WorkspaceTypeId } from "./workspace-type";
import { STARTER_WORKSPACE_TYPE } from "./workspace-type";

export interface WorkspaceTypeBinding {
  readonly workspaceType: WorkspaceTypeId;
  readonly pluginId: WorkspacePluginId;
}

export const DEFAULT_WORKSPACE_TYPE_BINDINGS: readonly WorkspaceTypeBinding[] = [
  { workspaceType: STARTER_WORKSPACE_TYPE, pluginId: STARTER_WORKSPACE_PLUGIN_ID },
];

export function resolveWorkspacePluginIdForType(
  workspaceType: WorkspaceTypeId,
  bindings: readonly WorkspaceTypeBinding[] = DEFAULT_WORKSPACE_TYPE_BINDINGS,
): WorkspacePluginId | null {
  return bindings.find((b) => b.workspaceType === workspaceType)?.pluginId ?? null;
}
