import { TenantProvisionConflictError } from "../../src/internal/provisioning.errors";
import type { ProvisionTenantInput } from "../../src/internal/provisioning.service";

export type StagingTenantIdentityRecord = Readonly<{
  id: string;
  subdomain: string;
  workspaceType: string;
  status: string;
}>;

/** Maps the ledger's `id` shape to the provisioning API's required `tenantId` field. */
export function toSecondStagingTenantProvisionInput(
  expected: StagingTenantIdentityRecord
): ProvisionTenantInput {
  return {
    tenantId: expected.id,
    subdomain: expected.subdomain,
    workspaceType: expected.workspaceType,
    status: expected.status,
  };
}

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
