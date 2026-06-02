import type { WorkspacePlugin } from "./workspace-plugin.contract";

/**
 * Stable workspace type identifier persisted on tours (`workspace_type` column).
 * Distinct from plugin id when one plugin serves multiple types (future).
 */
export type WorkspaceTypeId = string;

/** Built-in reference workspace for phase 0–2 bootstrap. */
export const STARTER_WORKSPACE_TYPE = "starter" as const satisfies WorkspaceTypeId;

const DEFAULT_STARTER_TYPE_SET = new Set<string>([STARTER_WORKSPACE_TYPE]);

export function workspaceTypesFromPlugin(plugin: WorkspacePlugin): ReadonlySet<string> {
  return new Set(plugin.supportedWorkspaceTypes);
}

export function isWorkspaceTypeId(
  value: unknown,
  allowed: ReadonlySet<string> = DEFAULT_STARTER_TYPE_SET,
): value is WorkspaceTypeId {
  return typeof value === "string" && value.length > 0 && allowed.has(value);
}
