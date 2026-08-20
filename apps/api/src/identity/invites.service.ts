import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { getIdentityRepository, type IdentityRepository } from "./create-identity-repository";
import {
  InviteNotFoundError,
  InviteLifecycleError,
  assertInviteAcceptCreatesMembership,
} from "./in-memory-identity.repository";
import type { AcceptInviteResponse } from "./users.types";
import {
  INVITE_EXPIRED,
  evaluateInviteLifecycleForAccept,
} from "./users-rbac.policy";
import { OPERATOR_INVITE_STATUS_INVITED } from "./invite-lifecycle";

export class InvitePhoneMismatchError extends Error {
  readonly code = "INVITE_PHONE_MISMATCH" as const;

  constructor() {
    super("INVITE_PHONE_MISMATCH");
    this.name = "InvitePhoneMismatchError";
  }
}

export class InviteTenantMismatchError extends Error {
  readonly code = "INVITE_TENANT_MISMATCH" as const;

  constructor() {
    super("INVITE_TENANT_MISMATCH");
    this.name = "InviteTenantMismatchError";
  }
}

export async function acceptWorkspaceInvite(
  auth: TenantAuthContext,
  inviteToken: string,
  repo: IdentityRepository = getIdentityRepository()
): Promise<AcceptInviteResponse> {
  const invite = await repo.findInviteByToken(inviteToken);
  if (invite === null) {
    throw new InviteNotFoundError(inviteToken);
  }

  if (auth.tenantId !== invite.tenantId) {
    throw new InviteTenantMismatchError();
  }

  const user = await repo.findUserById(auth.userId);
  if (user === null || user.mobile !== invite.phone) {
    throw new InvitePhoneMismatchError();
  }

  const lifecycle = evaluateInviteLifecycleForAccept({
    status: invite.status,
    expiresAt: invite.expiresAt,
  });
  if (!lifecycle.ok) {
    if (lifecycle.code === INVITE_EXPIRED && invite.status === OPERATOR_INVITE_STATUS_INVITED) {
      await repo.markInviteExpired(invite.inviteId);
    }
    throw new InviteLifecycleError(lifecycle.code, invite.inviteId);
  }

  const existing = await repo.findMembership(auth.userId, invite.tenantId);
  assertInviteAcceptCreatesMembership(existing === null ? null : existing.role);

  const membership = await repo.acceptPendingInvite(invite.tenantId, inviteToken, auth.userId);
  if (membership === null) {
    throw new InviteNotFoundError(inviteToken);
  }

  return {
    tenantId: invite.tenantId,
    userId: auth.userId,
    role: membership.role,
    status: "ACTIVE",
    inviteId: invite.inviteId,
  };
}
