import { ROLE_RANK } from "../../../../../packages/shared/rbac/workspace-roles";

/**
 * Central workspace membership RBAC policy (ordering + transition rules).
 *
 * Target product hierarchy (highest first): owner > leader > admin > member > viewer.
 * Persisted membership roles in this codebase today: owner, admin, member, viewer.
 * The `leader` rank is reserved for a future persisted role; it is not assignable via
 * current HTTP DTOs — see GENERAL_PATCH_ASSIGNABLE_ROLES / INVITE_ASSIGNABLE_ROLES.
 *
 * General PATCH /api/v2/users/:id is intentionally stricter than invites: it never
 * assigns `owner` and never mutates an existing `owner` membership row (owner changes
 * belong to a dedicated flow, not implemented here). Invite-based assignment to `owner`
 * is also forbidden.
 */

export const RBAC_SELF_ROLE_CHANGE_FORBIDDEN = "RBAC_SELF_ROLE_CHANGE_FORBIDDEN";
export const RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN = "RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN";
export const RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN =
  "RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN";
export const RBAC_INSUFFICIENT_ROLE_PRIVILEGE = "RBAC_INSUFFICIENT_ROLE_PRIVILEGE";
export const RBAC_UNKNOWN_MEMBERSHIP_ROLE = "RBAC_UNKNOWN_MEMBERSHIP_ROLE";

/** Higher number = higher privilege. Includes structural `leader` for future use. */
export const WORKSPACE_MEMBERSHIP_ROLE_RANK: Readonly<Record<string, number>> = ROLE_RANK;

/** Roles that may exist in `user_tenants.role` today (lowercase persisted strings). */
export const PERSISTED_WORKSPACE_MEMBERSHIP_ROLES = Object.freeze([
  "owner",
  "admin",
  "member",
  "viewer"
] as const);

export type PersistedWorkspaceMembershipRole = (typeof PERSISTED_WORKSPACE_MEMBERSHIP_ROLES)[number];

/**
 * Roles allowed as the NEW role on PATCH /api/v2/users/:id (general update).
 * Excludes `owner` (use a dedicated owner-transfer flow when product adds one).
 */
export const GENERAL_PATCH_ASSIGNABLE_ROLES = Object.freeze(["admin", "member", "viewer"] as const);
export type GeneralPatchAssignableRole = (typeof GENERAL_PATCH_ASSIGNABLE_ROLES)[number];

/**
 * Roles allowed on workspace invite creation DTO.
 * Excludes `owner` and `leader` (ownership changes require a dedicated transfer flow).
 */
export const INVITE_ASSIGNABLE_ROLES = Object.freeze(["admin", "member", "viewer"] as const);
export type InviteAssignableRole = (typeof INVITE_ASSIGNABLE_ROLES)[number];

const LEGACY_ROLE_ALIASES: Readonly<Record<string, PersistedWorkspaceMembershipRole>> = Object.freeze({
  operator: "member"
});

export function normalizeWorkspaceMembershipRole(
  role: string | undefined | null
): PersistedWorkspaceMembershipRole | undefined {
  if (role === undefined || role === null) {
    return undefined;
  }
  const key = role.trim().toLowerCase();
  if (key === "") {
    return undefined;
  }
  if ((PERSISTED_WORKSPACE_MEMBERSHIP_ROLES as readonly string[]).includes(key)) {
    return key as PersistedWorkspaceMembershipRole;
  }
  const mapped = LEGACY_ROLE_ALIASES[key];
  return mapped;
}

export function getWorkspaceMembershipRoleRank(role: string | undefined | null): number | undefined {
  const normalized = normalizeWorkspaceMembershipRole(role);
  if (!normalized) {
    return undefined;
  }
  return WORKSPACE_MEMBERSHIP_ROLE_RANK[normalized];
}

export type RbacPolicyFailure = {
  ok: false;
  code: string;
  message: string;
};

export type RbacPolicySuccess = { ok: true };

export type GeneralMembershipRoleChangeDecision = RbacPolicySuccess | RbacPolicyFailure;

/**
 * Rules for PATCH /api/v2/users/:id (general role update).
 * - No self change.
 * - Target `owner` rows are immutable on this endpoint.
 * - New role cannot be `owner`.
 * - Actor must outrank target and must outrank the new role (strict > for both).
 */
export function evaluateGeneralMembershipRoleChange(input: {
  actorUserId: string;
  actorRole: string | undefined;
  targetUserId: string;
  targetCurrentRole: string | undefined;
  newRole: string;
}): GeneralMembershipRoleChangeDecision {
  if (input.actorUserId.trim() === input.targetUserId.trim()) {
    return {
      ok: false,
      code: RBAC_SELF_ROLE_CHANGE_FORBIDDEN,
      message: "You cannot change your own workspace role on this endpoint"
    };
  }

  const newNorm = normalizeWorkspaceMembershipRole(input.newRole);
  if (!newNorm || !(GENERAL_PATCH_ASSIGNABLE_ROLES as readonly string[]).includes(newNorm)) {
    return {
      ok: false,
      code: RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN,
      message: "The requested role is not allowed for general workspace role updates"
    };
  }

  if (newNorm === "owner") {
    return {
      ok: false,
      code: RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN,
      message: "Assigning the owner role is not permitted on this endpoint"
    };
  }

  const targetNorm = normalizeWorkspaceMembershipRole(input.targetCurrentRole);
  if (!targetNorm) {
    return {
      ok: false,
      code: RBAC_UNKNOWN_MEMBERSHIP_ROLE,
      message: "Target membership role is unknown or unsupported"
    };
  }

  if (targetNorm === "owner") {
    return {
      ok: false,
      code: RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN,
      message: "The workspace owner role cannot be modified through general role updates"
    };
  }

  const actorNorm = normalizeWorkspaceMembershipRole(input.actorRole);
  if (!actorNorm) {
    return {
      ok: false,
      code: RBAC_INSUFFICIENT_ROLE_PRIVILEGE,
      message: "Your workspace role does not allow this membership change"
    };
  }

  const actorRank = WORKSPACE_MEMBERSHIP_ROLE_RANK[actorNorm];
  const targetRank = WORKSPACE_MEMBERSHIP_ROLE_RANK[targetNorm];
  const newRank = WORKSPACE_MEMBERSHIP_ROLE_RANK[newNorm];

  if (actorRank === undefined || targetRank === undefined || newRank === undefined) {
    return {
      ok: false,
      code: RBAC_INSUFFICIENT_ROLE_PRIVILEGE,
      message: "Your workspace role does not allow this membership change"
    };
  }

  if (actorRank <= targetRank) {
    return {
      ok: false,
      code: RBAC_INSUFFICIENT_ROLE_PRIVILEGE,
      message: "You cannot modify a member with equal or higher workspace role than your own"
    };
  }

  if (actorRank <= newRank) {
    return {
      ok: false,
      code: RBAC_INSUFFICIENT_ROLE_PRIVILEGE,
      message: "You cannot assign a workspace role equal to or above your own"
    };
  }

  return { ok: true };
}

export type WorkspaceInviteRoleDecision = RbacPolicySuccess | RbacPolicyFailure;

/**
 * Inviter may invite at or below their own rank (same rule as previous ROLE_HIERARCHY,
 * extended to viewer + structural ranks).
 */
export function evaluateWorkspaceInviteRole(input: {
  inviterRole: string | undefined;
  invitedRole: string;
}): WorkspaceInviteRoleDecision {
  const invitedNorm = normalizeWorkspaceMembershipRole(input.invitedRole);
  if (!invitedNorm || !(INVITE_ASSIGNABLE_ROLES as readonly string[]).includes(invitedNorm)) {
    return {
      ok: false,
      code: RBAC_INSUFFICIENT_ROLE_PRIVILEGE,
      message: "The invited role is not allowed"
    };
  }

  const inviterNorm = normalizeWorkspaceMembershipRole(input.inviterRole);
  if (!inviterNorm) {
    return {
      ok: false,
      code: RBAC_INSUFFICIENT_ROLE_PRIVILEGE,
      message: "Your workspace role does not allow creating invites"
    };
  }

  const inviterRank = WORKSPACE_MEMBERSHIP_ROLE_RANK[inviterNorm];
  const invitedRank = WORKSPACE_MEMBERSHIP_ROLE_RANK[invitedNorm];
  if (inviterRank === undefined || invitedRank === undefined) {
    return {
      ok: false,
      code: RBAC_INSUFFICIENT_ROLE_PRIVILEGE,
      message: "Your workspace role does not allow creating invites"
    };
  }

  if (inviterRank < invitedRank) {
    return {
      ok: false,
      code: RBAC_INSUFFICIENT_ROLE_PRIVILEGE,
      message: "Cannot invite with a role above your workspace privilege"
    };
  }

  return { ok: true };
}
