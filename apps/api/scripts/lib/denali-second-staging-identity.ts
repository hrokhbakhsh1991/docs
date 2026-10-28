import { TenantProvisionConflictError } from "../../src/internal/provisioning.errors";

export type StagingTenantIdentityRecord = Readonly<{
  id: string;
  subdomain: string;
  workspaceType: string;
  status: string;
}>;

/** Accepts only the exact identity reserved for B; all ID or slug collisions fail closed. */
export function resolveSecondStagingTenantExistingRecord(
  byId: StagingTenantIdentityRecord | null,
  bySubdomain: StagingTenantIdentityRecord | null,
  expected: StagingTenantIdentityRecord
): StagingTenantIdentityRecord | null {
  if (byId === null && bySubdomain === null) return null;

  if (
    byId !== null &&
    bySubdomain !== null &&
    byId.id === bySubdomain.id &&
    byId.id === expected.id &&
    byId.subdomain === expected.subdomain &&
    byId.workspaceType === expected.workspaceType &&
    byId.status === expected.status
  ) {
    return byId;
  }

  throw new TenantProvisionConflictError(
    byId !== null ? "TENANT_ID_ALREADY_EXISTS" : "TENANT_SUBDOMAIN_ALREADY_EXISTS"
  );
}
