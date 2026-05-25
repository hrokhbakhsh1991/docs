import { UserRole, tryParseWorkspaceUserRole } from "../auth/user-role.enum";

/** Persisted `user_tenants.role` or any object carrying a workspace role string. */
export type WorkspaceMembershipRoleSource = {
  readonly role?: string | null;
};

export type WorkspaceRoleInput = string | WorkspaceMembershipRoleSource | null | undefined;

function resolveWorkspaceRole(input: WorkspaceRoleInput): UserRole | undefined {
  if (input === null || input === undefined) {
    return undefined;
  }
  const raw = typeof input === "string" ? input : input.role;
  return tryParseWorkspaceUserRole(raw ?? undefined);
}

export function isWorkspaceAdmin(membership: WorkspaceRoleInput): boolean {
  return resolveWorkspaceRole(membership) === UserRole.Admin;
}

export function isWorkspaceOwner(membership: WorkspaceRoleInput): boolean {
  return resolveWorkspaceRole(membership) === UserRole.Owner;
}

export function isWorkspaceLeader(membership: WorkspaceRoleInput): boolean {
  return resolveWorkspaceRole(membership) === UserRole.Leader;
}

export function isWorkspaceMember(membership: WorkspaceRoleInput): boolean {
  return resolveWorkspaceRole(membership) === UserRole.Member;
}

export function isWorkspaceViewer(membership: WorkspaceRoleInput): boolean {
  return resolveWorkspaceRole(membership) === UserRole.Viewer;
}

/** Owner, admin, or leader — tenant-wide row scope (registrations, payments, waitlist). */
export function isWorkspaceLeaderOrAbove(membership: WorkspaceRoleInput): boolean {
  const role = resolveWorkspaceRole(membership);
  return role === UserRole.Owner || role === UserRole.Admin || role === UserRole.Leader;
}

/**
 * Owner or admin — directory PII, settings-style administrative reads/writes at service layer.
 */
export function canPerformAdministrativeAction(membership: WorkspaceRoleInput): boolean {
  const role = resolveWorkspaceRole(membership);
  return role === UserRole.Owner || role === UserRole.Admin;
}

/** Target row is workspace owner (protected from suspend/remove/general role PATCH). */
export function isProtectedWorkspaceOwnerMembership(membership: WorkspaceRoleInput): boolean {
  return isWorkspaceOwner(membership);
}

/** Platform admin actor may bypass JWT tenant binding on cross-tenant reads. */
export function canActAsPlatformAdminWithoutTenant(membership: WorkspaceRoleInput): boolean {
  return isWorkspaceAdmin(membership);
}

/** Finance receipt upload staff path (admin, owner, or leader). */
export function canUploadReceiptAsWorkspaceStaff(membership: WorkspaceRoleInput): boolean {
  return isWorkspaceLeaderOrAbove(membership);
}

/** Owner, leader, or admin — staff pricing discount band (finance / legacy catalog). */
export function qualifiesForStaffPricingDiscount(membership: WorkspaceRoleInput): boolean {
  return isWorkspaceLeaderOrAbove(membership);
}

/**
 * Sensitive trip-details PATCH without `TourTripDetailsSensitive` capability
 * (owner, admin, or leader).
 */
export function mayPatchSensitiveTripDetailsByRole(membership: WorkspaceRoleInput): boolean {
  return isWorkspaceLeaderOrAbove(membership);
}

/** JWT has trusted tenant context, or actor is platform admin without tenant binding. */
export function actorHasTrustedTenantOrPlatformAdminBypass(
  actorRole: WorkspaceRoleInput,
  trustedTenantId: string | null | undefined,
): boolean {
  return Boolean(trustedTenantId) || canActAsPlatformAdminWithoutTenant(actorRole);
}

/**
 * Registration row is in actor tenant scope, or actor is platform admin (cross-tenant read/write).
 */
export function registrationTenantMatchesActorScope(
  actorRole: WorkspaceRoleInput,
  trustedTenantId: string | null | undefined,
  registrationTenantId: string,
): boolean {
  if (canActAsPlatformAdminWithoutTenant(actorRole)) {
    return true;
  }
  return Boolean(trustedTenantId && registrationTenantId === trustedTenantId);
}
