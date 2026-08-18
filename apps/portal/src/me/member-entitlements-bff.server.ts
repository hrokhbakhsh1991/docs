import { evaluateMemberPortalEntitlements } from "@app-tour/workspace-sdk";

import { resolveTourOpsApiBaseUrl } from "@/env";

import { classifyMemberProfileBffFailure } from "./classify-member-profile-bff-error";

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

export type MemberEntitlementsUpstreamResult =
  | { readonly status: "ok"; readonly payload: MemberEntitlementsPayload }
  | { readonly status: "http"; readonly httpStatus: number; readonly code?: string }
  | { readonly status: "network" };

export type MemberEntitlementsResolveAuth = "ok" | "unauthenticated" | "unavailable";

export type MemberEntitlementsResolveResult = {
  readonly auth: MemberEntitlementsResolveAuth;
  readonly cacheable: boolean;
  readonly payload: MemberEntitlementsPayload;
};

/** Local evaluator when API upstream unavailable (dev rollout / outage shim). */
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

function emptyMemberEntitlementsPayload(input: {
  readonly tenantId: string;
  readonly pluginId: string;
}): MemberEntitlementsPayload {
  return Object.freeze({
    ok: true,
    tenantId: input.tenantId,
    workspaceId: input.pluginId,
    evaluatedAt: new Date().toISOString(),
    granted: Object.freeze([] as string[]),
    denied: Object.freeze([] as MemberEntitlementDenial[]),
  });
}

function readUpstreamErrorCode(body: unknown): string | undefined {
  if (body === null || typeof body !== "object") {
    return undefined;
  }
  const record = body as Record<string, unknown>;
  if (typeof record.code === "string" && record.code.trim().length > 0) {
    return record.code.trim();
  }
  const error = record.error;
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  if (error !== null && typeof error === "object") {
    const nested = (error as { readonly code?: unknown }).code;
    if (typeof nested === "string" && nested.trim().length > 0) {
      return nested.trim();
    }
  }
  return undefined;
}

export async function fetchMemberEntitlementsUpstream(
  host: string,
  apiHeaders: Record<string, string>
): Promise<MemberEntitlementsUpstreamResult> {
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
    return { status: "network" };
  }

  const body = (await backendRes.json().catch(() => ({}))) as MemberEntitlementsPayload & {
    ok?: unknown;
    denied?: MemberEntitlementDenial[];
  };
  if (backendRes.ok && body.ok === true) {
    return {
      status: "ok",
      payload: Object.freeze({
        ok: true,
        tenantId: body.tenantId,
        workspaceId: body.workspaceId,
        evaluatedAt: body.evaluatedAt,
        granted: Object.freeze([...body.granted]),
        denied: Object.freeze([...(body.denied ?? [])]),
      }),
    };
  }

  return {
    status: "http",
    httpStatus: backendRes.status,
    code: readUpstreamErrorCode(body),
  };
}

/** Prefer API upstream; SDK shim only on outage — never on dead session. */
export async function resolveMemberEntitlementsPayload(input: {
  readonly host: string;
  readonly tenantId: string;
  readonly pluginId: string;
  readonly apiHeaders: Record<string, string>;
}): Promise<MemberEntitlementsResolveResult> {
  const upstream = await fetchMemberEntitlementsUpstream(input.host, input.apiHeaders);
  if (upstream.status === "ok") {
    return { auth: "ok", cacheable: true, payload: upstream.payload };
  }

  if (upstream.status === "http") {
    const kind = classifyMemberProfileBffFailure(upstream.httpStatus, upstream.code);
    if (kind === "unauthenticated") {
      return {
        auth: "unauthenticated",
        cacheable: false,
        payload: emptyMemberEntitlementsPayload(input),
      };
    }
  }

  return {
    auth: "unavailable",
    cacheable: false,
    payload: buildMemberEntitlementsPayload({
      tenantId: input.tenantId,
      pluginId: input.pluginId,
    }),
  };
}
