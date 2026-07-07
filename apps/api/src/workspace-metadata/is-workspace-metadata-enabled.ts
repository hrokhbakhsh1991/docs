/** P3-A — when true, tenants with metadata binding use DB definition + package overlay. */
export function isWorkspaceMetadataEnabled(): boolean {
  const raw = process.env.WORKSPACE_METADATA_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
