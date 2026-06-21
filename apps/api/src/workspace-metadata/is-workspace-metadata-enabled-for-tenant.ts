import { isWorkspaceMetadataEnabled } from "./is-workspace-metadata-enabled.ts";

/** P3-D — optional per-tenant pilot gate when `WORKSPACE_METADATA_TENANT_ALLOWLIST` is set. */
export function isWorkspaceMetadataEnabledForTenant(tenantId: string): boolean {
  if (!isWorkspaceMetadataEnabled()) {
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

export function isWorkspaceMetadataTenantAllowlistConfigured(): boolean {
  return (process.env.WORKSPACE_METADATA_TENANT_ALLOWLIST?.trim().length ?? 0) > 0;
}
