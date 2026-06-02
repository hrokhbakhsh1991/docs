import {
  allowedRegionIdsFromGrantContext,
  hasRegionalTourManageCapability,
  type CapabilityGrantContext,
} from "@repo/shared";

import type { RequestContextService } from "../request-context/request-context.service";

export function buildCapabilityGrantContextFromRequest(
  requestContext: RequestContextService,
): CapabilityGrantContext {
  return {
    role: requestContext.tryGetRole() ?? "",
    labels: requestContext.tryGetAbilityLabels() ?? null,
    capabilities: requestContext.tryGetWorkspaceCapabilities() ?? null,
    tenantModules: requestContext.tryGetTenantEnabledModules() ?? null,
    membershipMetadata: requestContext.tryGetMembershipMetadata(),
  };
}

export type RegionalTourListScope = {
  restrictToRegions: boolean;
  allowedRegionIds: readonly string[];
};

export function buildRegionalTourListScopeFromRequest(
  requestContext: RequestContextService,
): RegionalTourListScope {
  const grantContext = buildCapabilityGrantContextFromRequest(requestContext);
  const restrictToRegions = hasRegionalTourManageCapability(grantContext);
  return {
    restrictToRegions,
    allowedRegionIds: restrictToRegions
      ? allowedRegionIdsFromGrantContext(grantContext)
      : [],
  };
}
