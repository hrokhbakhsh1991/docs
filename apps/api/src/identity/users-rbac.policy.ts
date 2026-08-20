import type { ActorRole } from "@app-tour/workspace-sdk";

import type { InvitableWorkspaceRole } from "./users.types";

const ROLE_RANK: Readonly<Record<ActorRole, number>> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
  none: 0,
};

export type PatchableWorkspaceRole = InvitableWorkspaceRole;

export const RBAC_SELF_ROLE_CHANGE_FORBIDDEN = "RBAC_SELF_ROLE_CHANGE_FORBIDDEN" as const;
export const RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN = "RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN" as const;
export const RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN =
  "RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN" as const;
export const RBAC_INSUFFICIENT_ROLE_PRIVILEGE = "RBAC_INSUFFICIENT_ROLE_PRIVILEGE" as const;
export const INVITE_ACCEPT_OWNER_PROTECTED = "INVITE_ACCEPT_OWNER_PROTECTED" as const;
export const INVITE_ACCEPT_MEMBERSHIP_EXISTS = "INVITE_ACCEPT_MEMBERSHIP_EXISTS" as const;
export const INVITE_ALREADY_PENDING = "INVITE_ALREADY_PENDING" as const;

export type RbacPolicyFailure = {
  readonly ok: false;
  readonly code:
    | typeof RBAC_SELF_ROLE_CHANGE_FORBIDDEN
    | typeof RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN
    | typeof RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN
    | typeof RBAC_INSUFFICIENT_ROLE_PRIVILEGE;
};

export type RbacPolicySuccess = { readonly ok: true };

export type MembershipRoleChangeDecision = RbacPolicySuccess | RbacPolicyFailure;

function roleRank(role: ActorRole): number {
  return ROLE_RANK[role];
}

export function evaluateMembershipRoleChange(input: {
  readonly actorUserId: string;
  readonly actorRole: ActorRole;
  readonly targetUserId: string;
  readonly targetCurrentRole: ActorRole;
  readonly newRole: PatchableWorkspaceRole;
}): MembershipRoleChangeDecision {
  if (input.actorUserId === input.targetUserId) {
    return { ok: false, code: RBAC_SELF_ROLE_CHANGE_FORBIDDEN };
  }

  if (input.targetCurrentRole === "owner") {
    return { ok: false, code: RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN };
  }

  const actorRank = roleRank(input.actorRole);
  const targetRank = roleRank(input.targetCurrentRole);
  const newRank = roleRank(input.newRole);

  if (actorRank <= targetRank) {
    return { ok: false, code: RBAC_INSUFFICIENT_ROLE_PRIVILEGE };
  }

  if (actorRank <= newRank) {
    return { ok: false, code: RBAC_INSUFFICIENT_ROLE_PRIVILEGE };
  }

  return { ok: true };
}

export type MembershipRemovalDecision = RbacPolicySuccess | RbacPolicyFailure;

export function evaluateMembershipRemoval(input: {
  readonly actorUserId: string;
  readonly actorRole: ActorRole;
  readonly targetUserId: string;
  readonly targetCurrentRole: ActorRole;
}): MembershipRemovalDecision {
  if (input.actorUserId === input.targetUserId) {
    return { ok: false, code: RBAC_SELF_ROLE_CHANGE_FORBIDDEN };
  }

  if (input.targetCurrentRole === "owner") {
    return { ok: false, code: RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN };
  }

  const actorRank = roleRank(input.actorRole);
  const targetRank = roleRank(input.targetCurrentRole);

  if (actorRank <= targetRank) {
    return { ok: false, code: RBAC_INSUFFICIENT_ROLE_PRIVILEGE };
  }

  return { ok: true };
}

export type InviteAcceptFailure = {
  readonly ok: false;
  readonly code: typeof INVITE_ACCEPT_OWNER_PROTECTED | typeof INVITE_ACCEPT_MEMBERSHIP_EXISTS;
};

export type InviteAcceptDecision = RbacPolicySuccess | InviteAcceptFailure;

/**
 * Invite accept is join-only. Existing UserTenant in the invite tenant must not be upserted.
 * Suspended rows are rejected — reactivate stays PATCH /users/{id}/reactivate.
 */
export function evaluateInviteAccept(input: {
  readonly existingMembershipRole: string | null;
}): InviteAcceptDecision {
  if (input.existingMembershipRole === null) {
    return { ok: true };
  }

  const role = input.existingMembershipRole.trim().toLowerCase();
  if (role === "owner") {
    return { ok: false, code: INVITE_ACCEPT_OWNER_PROTECTED };
  }

  return { ok: false, code: INVITE_ACCEPT_MEMBERSHIP_EXISTS };
}

export type InviteCreateFailure = {
  readonly ok: false;
  readonly code: typeof INVITE_ALREADY_PENDING;
};

export type InviteCreateDecision = RbacPolicySuccess | InviteCreateFailure;

/**
 * At most one INVITED row per (tenantId, normalized phone). Checked at createPendingInvite write boundary.
 */
export function evaluateInviteCreate(input: {
  readonly existingPendingInvite: { readonly inviteId: string } | null;
}): InviteCreateDecision {
  if (input.existingPendingInvite !== null) {
    return { ok: false, code: INVITE_ALREADY_PENDING };
  }
  return { ok: true };
}
