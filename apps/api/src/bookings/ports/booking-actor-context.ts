/**
 * Application actor context for booking use-cases.
 * Structurally compatible with host TenantAuthContext — must not import workspace-sdk.
 */

export type BookingActorRole = "owner" | "admin" | "member" | "viewer" | "none";

export type BookingMembershipStatus = "ACTIVE" | "SUSPENDED";

export type BookingActorContext = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: BookingActorRole;
  readonly status: BookingMembershipStatus;
  readonly workspaceId?: string;
};
