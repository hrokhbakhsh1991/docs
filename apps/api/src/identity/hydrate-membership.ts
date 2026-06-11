import {
  parseTenantAuthContext,
  type ActorRole,
  type MembershipStatus,
  type TenantAuthContext,
} from "@app-tour/workspace-sdk";

import { AuthTokenRevokedError } from "./identity.errors";
import {
  getIdentityRepository,
  type IdentityRepository,
} from "./create-identity-repository";

export function normalizeMembershipRole(role: string): ActorRole {
  const trimmed = role.trim().toLowerCase();
  if (trimmed === "leader") return "admin";
  if (
    trimmed === "owner" ||
    trimmed === "admin" ||
    trimmed === "member" ||
    trimmed === "viewer"
  ) {
    return trimmed;
  }
  return "none";
}

export async function hydrateMembershipFromDb(
  userId: string,
  tenantId: string,
  sessionVersionClaim: number | undefined,
  repo: IdentityRepository = getIdentityRepository()
): Promise<TenantAuthContext> {
  const membership = await repo.findMembership(userId, tenantId);
  if (membership === null || membership.status !== "ACTIVE") {
    throw new AuthTokenRevokedError();
  }

  if (
    sessionVersionClaim !== undefined &&
    sessionVersionClaim !== membership.sessionVersion
  ) {
    throw new AuthTokenRevokedError();
  }

  return parseTenantAuthContext({
    userId,
    tenantId,
    role: normalizeMembershipRole(membership.role),
    status: membership.status as MembershipStatus,
    ...(membership.workspaceId !== undefined ? { workspaceId: membership.workspaceId } : {}),
  });
}
