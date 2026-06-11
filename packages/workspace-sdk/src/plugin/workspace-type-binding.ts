import type { WorkspacePluginId } from "./workspace-plugin-id";
import type { WorkspaceTypeId } from "./workspace-type";

export interface WorkspaceTypeBinding {
  readonly workspaceType: WorkspaceTypeId;
  readonly pluginId: WorkspacePluginId;
}

/** Build-time manifest bindings (DEC-P10-001). */
export { WORKSPACE_MANIFEST_BINDINGS as DEFAULT_WORKSPACE_TYPE_BINDINGS } from "./workspace-manifest-bindings.generated";

export function resolveWorkspacePluginIdForType(
  workspaceType: WorkspaceTypeId,
  bindings: readonly WorkspaceTypeBinding[]
): WorkspacePluginId | null {
  return bindings.find((b) => b.workspaceType === workspaceType)?.pluginId ?? null;
}
