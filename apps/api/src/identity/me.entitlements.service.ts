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
  /** BP-7 — tenant-defined plan code after apply-plan (not a platform SKU). */
  readonly planCode?: string;
  readonly entitlementsRevision?: number;
  readonly capabilities?: Readonly<Record<string, boolean>>;
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
    const membershipMeta = await resolveMembershipPortalMeta(auth);
    const evaluation = evaluateMemberPortalEntitlements(pluginId, {
      explicitModuleIds: membershipMeta.moduleGrants,
    });
    return Object.freeze({
      ok: true,
      tenantId: auth.tenantId,
      workspaceId: pluginId,
      evaluatedAt: new Date().toISOString(),
      granted: evaluation.granted,
      denied: evaluation.denied,
      ...(membershipMeta.planCode !== undefined ? { planCode: membershipMeta.planCode } : {}),
      ...(membershipMeta.entitlementsRevision !== undefined
        ? { entitlementsRevision: membershipMeta.entitlementsRevision }
        : {}),
      ...(membershipMeta.capabilities !== undefined
        ? { capabilities: membershipMeta.capabilities }
        : {}),
    });
  } catch (error) {
    if (error instanceof MemberPortalNotConfiguredError) {
      return emptyMemberEntitlements(auth.tenantId, pluginId);
    }
    throw error;
  }
}

async function resolveMembershipPortalMeta(auth: TenantAuthContext): Promise<{
  readonly moduleGrants: readonly string[];
  readonly planCode?: string;
  readonly entitlementsRevision?: number;
  readonly capabilities?: Readonly<Record<string, boolean>>;
}> {
  const repo = getIdentityRepository();
  const membership = await repo.findMembership(auth.userId, auth.tenantId);
  if (membership === null) {
    return { moduleGrants: Object.freeze([]) };
  }
  const planCode = membership.portalPlanCode?.trim();
  const capabilities = membership.portalCapabilityFlags;
  return {
    moduleGrants: membership.portalModuleGrants ?? Object.freeze([]),
    ...(planCode !== undefined && planCode.length > 0 ? { planCode } : {}),
    ...(membership.portalEntitlementsRevision !== undefined
      ? { entitlementsRevision: membership.portalEntitlementsRevision }
      : {}),
    ...(capabilities !== undefined ? { capabilities } : {}),
  };
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
