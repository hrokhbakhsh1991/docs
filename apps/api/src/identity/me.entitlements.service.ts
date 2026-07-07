import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import {
  DEFAULT_WORKSPACE_TYPE_BINDINGS,
  evaluateMemberPortalEntitlements,
  MemberPortalNotConfiguredError,
  resolveWorkspacePluginIdForType,
  type WorkspaceTypeId,
} from "@app-tour/workspace-sdk";

import { getIdentityRepository } from "./create-identity-repository";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";

export type MemberEntitlementDenialReason =
  | "not_entitled"
  | "module_disabled"
  | "plan_limit";

export type MemberEntitlementDenial = {
  readonly key: string;
  readonly reason: MemberEntitlementDenialReason;
};

export type MemberEntitlementsResponse = {
  readonly ok: true;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly evaluatedAt: string;
  readonly granted: readonly string[];
  readonly denied: readonly MemberEntitlementDenial[];
};

/** PS-6 tier-aware evaluation; membership metadata may extend hidden-module grants. */
export async function getMemberEntitlements(
  auth: TenantAuthContext
): Promise<MemberEntitlementsResponse> {
  const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
  const pluginId = resolveWorkspacePluginIdForType(
    workspaceType as WorkspaceTypeId,
    DEFAULT_WORKSPACE_TYPE_BINDINGS
  );

  if (pluginId === null) {
    return emptyMemberEntitlements(auth.tenantId, workspaceType);
  }

  try {
    const explicitModuleIds = await resolveExplicitModuleGrants(auth);
    const evaluation = evaluateMemberPortalEntitlements(pluginId, { explicitModuleIds });
    return Object.freeze({
      ok: true,
      tenantId: auth.tenantId,
      workspaceId: pluginId,
      evaluatedAt: new Date().toISOString(),
      granted: evaluation.granted,
      denied: evaluation.denied,
    });
  } catch (error) {
    if (error instanceof MemberPortalNotConfiguredError) {
      return emptyMemberEntitlements(auth.tenantId, pluginId);
    }
    throw error;
  }
}

async function resolveExplicitModuleGrants(auth: TenantAuthContext): Promise<readonly string[]> {
  const repo = getIdentityRepository();
  const membership = await repo.findMembership(auth.userId, auth.tenantId);
  if (membership === null) {
    return Object.freeze([]);
  }
  return membership.portalModuleGrants ?? Object.freeze([]);
}

function emptyMemberEntitlements(
  tenantId: string,
  workspaceId: string
): MemberEntitlementsResponse {
  return Object.freeze({
    ok: true,
    tenantId,
    workspaceId,
    evaluatedAt: new Date().toISOString(),
    granted: Object.freeze([]),
    denied: Object.freeze([]),
  });
}
