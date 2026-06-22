import { isOperatorWorkspaceMetadataEnabled } from "./is-operator-workspace-metadata-enabled";

/** P5-B — optional per-tenant pilot gate when `WORKSPACE_METADATA_TENANT_ALLOWLIST` is set. */
export function isOperatorWorkspaceMetadataEnabledForTenant(tenantId: string): boolean {
  if (!isOperatorWorkspaceMetadataEnabled()) {
    return false;
  }
  const raw = process.env.WORKSPACE_METADATA_TENANT_ALLOWLIST?.trim();
  if (!raw) {
    return true;
  }
  const allowed = new Set(
    raw
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  );
  return allowed.has(tenantId);
}

export function isOperatorWorkspaceMetadataTenantAllowlistConfigured(): boolean {
  return (process.env.WORKSPACE_METADATA_TENANT_ALLOWLIST?.trim().length ?? 0) > 0;
}
