import { parseMembershipMetadata } from "@repo/shared";

import { normalizeMembershipLabels } from "../rbac/normalize-membership-labels";
import { parseTenantEnabledModules } from "../rbac/parse-tenant-enabled-modules";
import type { RequestContextService } from "../request-context/request-context.service";

export type MembershipAbilityHydrationRow = {
  labels: unknown;
  membership_metadata?: unknown;
  enabled_modules?: unknown;
};

export function hydrateWorkspaceAbilityContext(
  requestContext: RequestContextService,
  row: MembershipAbilityHydrationRow,
  status = "ACTIVE",
): void {
  const labels = normalizeMembershipLabels(row.labels);
  const meta = parseMembershipMetadata(row.membership_metadata);
  const tenantModules = parseTenantEnabledModules(row.enabled_modules);

  const membershipMetadata: Record<string, unknown> = {};
  if (meta.allowedRegionIds && meta.allowedRegionIds.length > 0) {
    membershipMetadata.allowedRegionIds = meta.allowedRegionIds;
  }
  if (meta.capabilities && meta.capabilities.length > 0) {
    membershipMetadata.capabilities = meta.capabilities;
  }

  requestContext.setWorkspaceAbilityContext(
    status,
    labels.length > 0 ? labels : undefined,
    meta.capabilities && meta.capabilities.length > 0 ? meta.capabilities : undefined,
    Object.keys(membershipMetadata).length > 0 ? membershipMetadata : undefined,
    tenantModules.length > 0 ? tenantModules : undefined,
  );
}
