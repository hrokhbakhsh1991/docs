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
export const INVITE_EXPIRED = "INVITE_EXPIRED" as const;
export const INVITE_REVOKED = "INVITE_REVOKED" as const;
export const INVITE_ALREADY_ACCEPTED = "INVITE_ALREADY_ACCEPTED" as const;

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

export type InviteLifecycleFailure = {
  readonly ok: false;
  readonly code:
    | typeof INVITE_EXPIRED
    | typeof INVITE_REVOKED
    | typeof INVITE_ALREADY_ACCEPTED;
};

export type InviteLifecycleDecision = RbacPolicySuccess | InviteLifecycleFailure;

/**
 * Accept is allowed only for active INVITED rows before expiresAt.
 * Expired INVITED is rejected (caller may persist EXPIRED at write boundary).
 */
export function evaluateInviteLifecycleForAccept(input: {
  readonly status: string;
  readonly expiresAt: Date;
  readonly now?: Date;
}): InviteLifecycleDecision {
  const now = input.now ?? new Date();
  const status = input.status.trim().toUpperCase();

  if (status === "ACCEPTED") {
    return { ok: false, code: INVITE_ALREADY_ACCEPTED };
  }
  if (status === "REVOKED") {
    return { ok: false, code: INVITE_REVOKED };
  }
  if (status === "EXPIRED") {
    return { ok: false, code: INVITE_EXPIRED };
  }
  if (status !== "INVITED") {
    return { ok: false, code: INVITE_REVOKED };
  }
  if (input.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, code: INVITE_EXPIRED };
  }
  return { ok: true };
}

/** Owner for cardinality = role owner AND status ACTIVE. Role-alone is not sufficient. */
export function isActiveOwner(input: {
  readonly role: string;
  readonly status: string;
}): boolean {
  return (
    input.role.trim().toLowerCase() === "owner" && input.status.trim().toUpperCase() === "ACTIVE"
  );
}

export const OWNERSHIP_TRANSFER_FORBIDDEN = "OWNERSHIP_TRANSFER_FORBIDDEN" as const;
export const OWNERSHIP_TRANSFER_TARGET_INVALID = "OWNERSHIP_TRANSFER_TARGET_INVALID" as const;

export type OwnerCardinalityFailure = {
  readonly ok: false;
  readonly code:
    | typeof RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN
    | typeof RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN
    | typeof OWNERSHIP_TRANSFER_FORBIDDEN
    | typeof OWNERSHIP_TRANSFER_TARGET_INVALID;
};

export type OwnerCardinalityDecision = RbacPolicySuccess | OwnerCardinalityFailure;

/**
 * PATCH cannot change an owner row. ACTIVE owner demotion is transfer-only.
 */
export function evaluateOwnerRoleChange(input: {
  readonly targetRole: string;
  readonly targetStatus: string;
  readonly newRole: PatchableWorkspaceRole;
}): OwnerCardinalityDecision {
  void input.newRole;
  if (input.targetRole.trim().toLowerCase() === "owner") {
    return { ok: false, code: RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN };
  }
  return { ok: true };
}

function remainingActiveOwnersAfterTargetChange(input: {
  readonly targetRole: string;
  readonly targetStatus: string;
  readonly activeOwnerCount: number;
}): number {
  const count = Math.max(0, input.activeOwnerCount);
  if (isActiveOwner({ role: input.targetRole, status: input.targetStatus })) {
    return Math.max(0, count - 1);
  }
  return count;
}

/**
 * Reject removing an ACTIVE owner, or any removal that would leave zero ACTIVE owners.
 */
export function evaluateOwnerMembershipRemoval(input: {
  readonly targetRole: string;
  readonly targetStatus: string;
  readonly activeOwnerCount: number;
}): OwnerCardinalityDecision {
  if (isActiveOwner({ role: input.targetRole, status: input.targetStatus })) {
    return { ok: false, code: RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN };
  }
  if (remainingActiveOwnersAfterTargetChange(input) === 0) {
    return { ok: false, code: RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN };
  }
  return { ok: true };
}

/**
 * Reject suspending an ACTIVE owner, or any suspend that would leave zero ACTIVE owners.
 */
export function evaluateOwnerMembershipSuspend(input: {
  readonly targetRole: string;
  readonly targetStatus: string;
  readonly activeOwnerCount: number;
}): OwnerCardinalityDecision {
  return evaluateOwnerMembershipRemoval(input);
}

/**
 * Insert a UserTenant with role=owner only when the tenant has zero ACTIVE owners (bootstrap).
 */
export function evaluateOwnerCreate(input: {
  readonly activeOwnerCount: number;
}): OwnerCardinalityDecision {
  if (input.activeOwnerCount > 0) {
    return { ok: false, code: RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN };
  }
  return { ok: true };
}

/** Shared write-boundary assert for platform owner invite accept (service + repo). */
export function assertOwnerCreateAllowed(activeOwnerCount: number): void {
  const decision = evaluateOwnerCreate({ activeOwnerCount });
  if (!decision.ok) {
    throw new OwnerCreateForbiddenError();
  }
}

/** Reject second ACTIVE owner at invite-accept write boundary. */
export class OwnerCreateForbiddenError extends Error {
  readonly statusCode = 403 as const;
  readonly code = RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN;

  constructor() {
    super(RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN);
    this.name = "OwnerCreateForbiddenError";
  }
}

export type OwnershipTransferSuccess = RbacPolicySuccess & {
  readonly previousOwnerNewRole: "admin";
  readonly targetNewRole: "owner";
};

export type OwnershipTransferDecision = OwnershipTransferSuccess | OwnerCardinalityFailure;

/**
 * Swap the unique ACTIVE owner to admin and promote an ACTIVE non-owner target.
 * Requires activeOwnerUserIds to be exactly [actorUserId] so the result is one ACTIVE owner.
 */
export function evaluateOwnershipTransfer(input: {
  readonly actorUserId: string;
  readonly actorRole: string;
  readonly actorStatus: string;
  readonly targetUserId: string;
  readonly targetExists: boolean;
  readonly targetRole: string | null;
  readonly targetStatus: string | null;
  readonly activeOwnerUserIds: readonly string[];
}): OwnershipTransferDecision {
  if (input.actorUserId === input.targetUserId) {
    return { ok: false, code: OWNERSHIP_TRANSFER_TARGET_INVALID };
  }

  if (
    !isActiveOwner({ role: input.actorRole, status: input.actorStatus }) ||
    input.activeOwnerUserIds.length !== 1 ||
    input.activeOwnerUserIds[0] !== input.actorUserId
  ) {
    return { ok: false, code: OWNERSHIP_TRANSFER_FORBIDDEN };
  }

  if (!input.targetExists || input.targetRole === null || input.targetStatus === null) {
    return { ok: false, code: OWNERSHIP_TRANSFER_TARGET_INVALID };
  }

  if (input.targetStatus.trim().toUpperCase() !== "ACTIVE") {
    return { ok: false, code: OWNERSHIP_TRANSFER_TARGET_INVALID };
  }

  if (isActiveOwner({ role: input.targetRole, status: input.targetStatus })) {
    return { ok: false, code: OWNERSHIP_TRANSFER_TARGET_INVALID };
  }

  return {
    ok: true,
    previousOwnerNewRole: "admin",
    targetNewRole: "owner",
  };
}
