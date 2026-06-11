/**
 * Stable workspace type identifier persisted on tours (`workspace_type` column).
 */
export type WorkspaceTypeId = string;

/** Built-in reference workspace for phase 0–2 bootstrap. */
export const STARTER_WORKSPACE_TYPE = "starter" as const satisfies WorkspaceTypeId;
