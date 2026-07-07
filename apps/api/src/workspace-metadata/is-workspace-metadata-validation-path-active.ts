import type { PlatformTenantRepository } from "../platform/platform-tenant.repository.ts";
import { isWorkspaceMetadataEnabledForTenant, isWorkspaceMetadataTenantAllowlistConfigured } from "./is-workspace-metadata-enabled-for-tenant.ts";
import { isWorkspaceMetadataEnabled } from "./is-workspace-metadata-enabled.ts";
import type { TenantWorkspaceMetadataBinding } from "./load-workspace-plugin-for-tenant.ts";
import { readTenantWorkspaceMetadataBinding } from "./read-tenant-workspace-metadata-binding.ts";

/** True when canonical validation runs against metadata overlay (not package-only path). */
export function isWorkspaceMetadataValidationPathActive(input: {
  readonly tenantId: string;
  readonly metadataBinding: TenantWorkspaceMetadataBinding | null;
}): boolean {
  if (!isWorkspaceMetadataEnabled() || !input.metadataBinding?.definitionId) {
    return false;
  }
  if (isWorkspaceMetadataTenantAllowlistConfigured()) {
    return isWorkspaceMetadataEnabledForTenant(input.tenantId);
  }
  return true;
}

export async function resolveWorkspaceMetadataValidationPathActive(
  tenantId: string,
  deps: {
    readonly tenantRepository?: PlatformTenantRepository;
  } = {}
): Promise<boolean> {
  if (!isWorkspaceMetadataEnabled()) {
    return false;
  }
  const binding = await readTenantWorkspaceMetadataBinding(tenantId, deps);
  return isWorkspaceMetadataValidationPathActive({
    tenantId,
    metadataBinding: binding?.metadataBinding ?? null,
  });
}
