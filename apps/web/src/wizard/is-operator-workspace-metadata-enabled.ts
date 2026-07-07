/** P5-B — when true, operator web may resolve metadata binding + package overlay. */
export function isOperatorWorkspaceMetadataEnabled(): boolean {
  const raw = process.env.WORKSPACE_METADATA_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
