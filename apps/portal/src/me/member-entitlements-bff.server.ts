import { evaluateMemberPortalEntitlements } from "@app-tour/workspace-sdk";

import { resolveTourOpsApiBaseUrl } from "@/env";

export type MemberEntitlementDenial = {
  readonly key: string;
  readonly reason: "not_entitled" | "module_disabled" | "plan_limit";
};

export type MemberEntitlementsPayload = {
  readonly ok: true;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly evaluatedAt: string;
  readonly granted: readonly string[];
  readonly denied: readonly MemberEntitlementDenial[];
};

/** Local evaluator when API upstream unavailable (dev rollout shim). */
export function buildMemberEntitlementsPayload(input: {
  readonly tenantId: string;
  readonly pluginId: string;
  readonly explicitModuleIds?: readonly string[];
}): MemberEntitlementsPayload {
  const evaluation = evaluateMemberPortalEntitlements(input.pluginId, {
    explicitModuleIds: input.explicitModuleIds,
  });
  return Object.freeze({
    ok: true,
    tenantId: input.tenantId,
    workspaceId: input.pluginId,
    evaluatedAt: new Date().toISOString(),
    granted: evaluation.granted,
    denied: evaluation.denied,
  });
}

export async function fetchMemberEntitlementsUpstream(
  host: string,
  apiHeaders: Record<string, string>
): Promise<MemberEntitlementsPayload | null> {
  const ingressHostname = host.split(":")[0] ?? host;
  let backendRes: Response;
  try {
    backendRes = await fetch(`${resolveTourOpsApiBaseUrl()}/identity/me/entitlements`, {
      method: "GET",
      headers: {
        ...apiHeaders,
        host: ingressHostname,
      },
      cache: "no-store",
    });
  } catch {
    return null;
  }

  const payload = (await backendRes.json().catch(() => ({}))) as MemberEntitlementsPayload & {
    ok?: unknown;
    denied?: MemberEntitlementDenial[];
  };
  if (!backendRes.ok || payload.ok !== true) {
    return null;
  }

  return Object.freeze({
    ok: true,
    tenantId: payload.tenantId,
    workspaceId: payload.workspaceId,
    evaluatedAt: payload.evaluatedAt,
    granted: Object.freeze([...payload.granted]),
    denied: Object.freeze([...(payload.denied ?? [])]),
  });
}

/** Prefer API upstream; fallback to local SDK evaluator. */
export async function resolveMemberEntitlementsPayload(input: {
  readonly host: string;
  readonly tenantId: string;
  readonly pluginId: string;
  readonly apiHeaders: Record<string, string>;
}): Promise<MemberEntitlementsPayload> {
  const upstream = await fetchMemberEntitlementsUpstream(input.host, input.apiHeaders);
  if (upstream !== null) {
    return upstream;
  }
  return buildMemberEntitlementsPayload({
    tenantId: input.tenantId,
    pluginId: input.pluginId,
  });
}
