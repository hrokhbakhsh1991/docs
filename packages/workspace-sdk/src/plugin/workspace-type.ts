import type { WorkspacePlugin } from "./workspace-plugin.contract";
import { STARTER_WORKSPACE_TYPE, type WorkspaceTypeId } from "./workspace-type-id";

export type { WorkspaceTypeId } from "./workspace-type-id";
export {
  DENALI_WORKSPACE_TYPE,
  STARTER_WORKSPACE_TYPE,
  URBAN_WORKSPACE_TYPE,
} from "./workspace-type-id";

const DEFAULT_STARTER_TYPE_SET = new Set<string>([STARTER_WORKSPACE_TYPE]);

export function workspaceTypesFromPlugin(plugin: WorkspacePlugin): ReadonlySet<string> {
  return new Set(plugin.supportedWorkspaceTypes);
}

export function isWorkspaceTypeId(
  value: unknown,
  allowed: ReadonlySet<string> = DEFAULT_STARTER_TYPE_SET
): value is WorkspaceTypeId {
  return typeof value === "string" && value.length > 0 && allowed.has(value);
}
