import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { getIdentityRepository, type IdentityRepository } from "./create-identity-repository";
import { InviteNotFoundError } from "./in-memory-identity.repository";
import type { AcceptInviteResponse } from "./users.types";

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
  const invite = await repo.findPendingInviteForAccept(inviteToken);
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
