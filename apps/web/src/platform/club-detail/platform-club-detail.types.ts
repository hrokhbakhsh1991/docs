export type PlatformClubDetail = {
  readonly tenant: {
    readonly id: string;
    readonly subdomain: string;
    readonly workspaceType: string;
    readonly status: string;
    readonly createdAt: string;
  };
  readonly sites: {
    readonly marketing: string;
    readonly portal: string;
    readonly admin: string;
  };
  readonly siteSurfaces: {
    readonly admin: boolean;
    readonly marketing: boolean;
    readonly portal: boolean;
  };
  readonly ownerInvite: {
    readonly inviteId: string;
    readonly phone: string;
    readonly status: string;
  } | null;
  readonly subscription: {
    readonly planId: string;
    readonly planDisplayName: string;
    readonly status: string;
    readonly currentPeriodEnd: string | null;
  } | null;
  readonly offboardingStartedAt: string | null;
  readonly scheduledDeletionAt: string | null;
  readonly workspaceDefinition: {
    readonly definitionId: string;
    readonly definitionVersion: number | null;
    readonly displayName: string | null;
  } | null;
};

export type PlatformClubDetailTab =
  | "overview"
  | "sites"
  | "domains"
  | "billing"
  | "workspace"
  | "owner"
  | "actions";

export const PLATFORM_CLUB_DETAIL_TABS: readonly PlatformClubDetailTab[] = [
  "overview",
  "sites",
  "domains",
  "billing",
  "workspace",
  "owner",
  "actions",
];

export function platformClubDetailPath(tenantId: string): string {
  return `/platform/clubs/${tenantId}`;
}
