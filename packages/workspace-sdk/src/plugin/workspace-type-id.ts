/**
 * Stable workspace type identifier persisted on tours (`workspace_type` column).
 */
export type WorkspaceTypeId = string;

/** Built-in reference workspace for phase 0–2 bootstrap. */
export const STARTER_WORKSPACE_TYPE = "starter" as const satisfies WorkspaceTypeId;

/** Denali product workspace (Phase 6). */
export const DENALI_WORKSPACE_TYPE = "denali" as const satisfies WorkspaceTypeId;

/** Urban second workspace (Phase 7). */
export const URBAN_WORKSPACE_TYPE = "urban" as const satisfies WorkspaceTypeId;
