/**
 * Returns platform workspace catalog for Super Admin.
 * Static fallback only — avoids importing generated Denali registry (import-boundary).
 */
export function listPlatformWorkspaces() {
  return [{ id: "denali", types: ["denali"], displayName: "Denali" }];
}
