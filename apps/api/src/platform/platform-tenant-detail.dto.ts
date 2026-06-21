import { buildClubSiteUrls } from "./build-club-site-urls.ts";
import type { TenantSiteSurfaces } from "./read-tenant-site-surfaces.ts";
import { DEFAULT_TENANT_SITE_SURFACES } from "./read-tenant-site-surfaces.ts";
import type { PlatformTenantDto } from "./platform-tenant.dto.ts";
import { toPlatformTenantDto } from "./platform-tenant.dto.ts";
import type { TenantSubscriptionDto } from "./platform-subscription.dto.ts";
import { toTenantSubscriptionDto } from "./platform-subscription.dto.ts";
import type { PlatformTenantRecord } from "./platform-tenant.repository.ts";
import type { TenantSubscriptionWithPlan } from "./platform-subscription.repository.ts";
import type { PlatformTenantWorkspaceDefinitionDto } from "./platform-tenant-workspace-definition.dto.ts";
import { toPlatformTenantWorkspaceDefinitionDto } from "./platform-tenant-workspace-definition.dto.ts";

export type PlatformOwnerInviteSummary = {
  readonly inviteId: string;
  readonly phone: string;
  readonly status: string;
};

export type PlatformTenantDetailDto = {
  readonly tenant: PlatformTenantDto;
  readonly sites: ReturnType<typeof buildClubSiteUrls>;
  readonly siteSurfaces: TenantSiteSurfaces;
  readonly ownerInvite: PlatformOwnerInviteSummary | null;
  readonly subscription: TenantSubscriptionDto | null;
  readonly workspaceDefinition: PlatformTenantWorkspaceDefinitionDto | null;
  readonly offboardingStartedAt: string | null;
  readonly scheduledDeletionAt: string | null;
};

export function toPlatformTenantDetailDto(input: {
  tenant: PlatformTenantRecord;
  ownerInvite: PlatformOwnerInviteSummary | null;
  subscription: TenantSubscriptionWithPlan | null;
  definitionDisplayName?: string | null;
  siteSurfaces?: TenantSiteSurfaces;
}): PlatformTenantDetailDto {
  return {
    tenant: toPlatformTenantDto(input.tenant),
    sites: buildClubSiteUrls(input.tenant.subdomain),
    siteSurfaces: input.siteSurfaces ?? DEFAULT_TENANT_SITE_SURFACES,
    ownerInvite: input.ownerInvite,
    subscription: input.subscription
      ? toTenantSubscriptionDto(input.subscription, input.subscription.plan)
      : null,
    workspaceDefinition: toPlatformTenantWorkspaceDefinitionDto({
      definitionId: input.tenant.workspaceDefinitionId,
      definitionVersion: input.tenant.workspaceDefinitionVersion,
      displayName: input.definitionDisplayName ?? null,
    }),
    offboardingStartedAt: input.tenant.offboardingStartedAt?.toISOString() ?? null,
    scheduledDeletionAt: input.tenant.scheduledDeletionAt?.toISOString() ?? null,
  };
}
