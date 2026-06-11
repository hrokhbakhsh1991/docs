import type { MembershipStatus, TenantAuthContext } from "@app-tour/workspace-sdk";

import {
  getIdentityRepository,
  type IdentityRepository,
} from "./create-identity-repository";
import { normalizeMembershipRole } from "./hydrate-membership";

export async function findPendingInviteByPhone(
  tenantId: string,
  mobile: string,
  repo: IdentityRepository = getIdentityRepository()
) {
  const normalized = mobile.trim();
  const invites = await repo.listPendingInvitesByTenant(tenantId);
  return (
    invites.find((invite) => invite.status === "INVITED" && invite.phone === normalized) ?? null
  );
}

export async function resolvePendingInviteAuth(
  userId: string,
  tenantId: string,
  repo: IdentityRepository = getIdentityRepository()
): Promise<TenantAuthContext | null> {
  const user = await repo.findUserById(userId);
  if (user === null) {
    return null;
  }
  const invite = await findPendingInviteByPhone(tenantId, user.mobile, repo);
  if (invite === null) {
    return null;
  }

  return {
    userId,
    tenantId,
    role: normalizeMembershipRole(invite.role),
    status: "SUSPENDED" satisfies MembershipStatus,
  };
}
