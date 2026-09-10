import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import type { TicketActorContext, TicketActorRole } from "@app-tour/ticketing-core";

import { getIdentityRepository } from "../identity/create-identity-repository";

function mapRole(role: TenantAuthContext["role"]): TicketActorRole {
  if (role === "owner" || role === "admin" || role === "member" || role === "viewer") {
    return role;
  }
  return "member";
}

export async function buildTicketActorContext(
  auth: TenantAuthContext,
  options?: {
    readonly loadTenantMembers?: boolean;
    readonly workspaceTicketingEnabled?: boolean;
  },
): Promise<TicketActorContext> {
  const role = mapRole(auth.role);
  let tenantMemberUserIds: readonly string[] | undefined;
  if (options?.loadTenantMembers === true || role === "viewer") {
    const repo = getIdentityRepository();
    const memberships = await repo.listMembershipsByTenant(auth.tenantId);
    tenantMemberUserIds = memberships
      .filter((membership) => membership.status === "ACTIVE")
      .map((membership) => membership.userId);
  }
  return {
    tenantId: auth.tenantId,
    userId: auth.userId,
    role,
    workspaceTicketingEnabled: options?.workspaceTicketingEnabled ?? true,
    readOnly: role === "viewer",
    ...(tenantMemberUserIds !== undefined ? { tenantMemberUserIds } : {}),
  };
}

export function assertOperatorEndpointRole(auth: TenantAuthContext): void {
  if (auth.role === "member") {
    throw new Error("FORBIDDEN_OPERATOR_ENDPOINT");
  }
}
