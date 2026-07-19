/**
 * Application actor context for finance use-cases.
 * Structurally compatible with host TenantAuthContext — must not import workspace-sdk.
 */

export type FinanceActorRole = "owner" | "admin" | "member" | "viewer" | "none";

export type FinanceMembershipStatus = "ACTIVE" | "SUSPENDED";

export type FinanceActorContext = {
  readonly userId: string;
  readonly tenantId: string;
  readonly role: FinanceActorRole;
  readonly status: FinanceMembershipStatus;
  readonly workspaceId?: string;
};
