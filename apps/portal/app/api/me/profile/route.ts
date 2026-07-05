import { NextResponse } from "next/server";

import { resolveTourOpsApiBaseUrl } from "@/env";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import {
  buildMemberProfileCacheKey,
  invalidateMemberProfileCache,
  readMemberProfileCache,
  writeMemberProfileCache,
} from "@/me/member-profile-cache.server";
import {
  buildMemberEntitlementsCacheKey,
  invalidateMemberEntitlementsCacheForMember,
} from "@/me/member-entitlements-cache.server";
import { buildMemberProfileApiError, normalizeMemberProfilePatchBody } from "@/me/member-profile-contract.server";
import {
  buildMemberProfileView,
  parseMemberProfilePatchBody,
  type IdentityMeUpstream,
} from "@/me/member-profile-bff.server";
import { logMemberProfileEvent } from "@/me/member-profile-observability.server";
import {
  buildMemberProfileRuntimeEnforcementContext,
  enforceMemberProfileRuntimeTruth,
  runMemberProfileRuntimeTruthCheck,
} from "@/me/member-profile-runtime-truth.server";
import type { MemberProfileViewPayload } from "@/me/member-profile-types";
import {
  memberProfileTraceResponseHeaders,
  resolveMemberProfileTraceId,
} from "@/me/member-profile-trace.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

function jsonMemberProfileError(
  code: string,
  status: number,
  traceId: string,
  fieldErrors?: Parameters<typeof buildMemberProfileApiError>[1]
): NextResponse {
  const body = buildMemberProfileApiError(code, fieldErrors);
  return NextResponse.json(body, {
    status,
    headers: memberProfileTraceResponseHeaders(traceId),
  });
}

function jsonMemberProfileSuccess(payload: unknown, traceId: string): NextResponse {
  return NextResponse.json(payload, {
    status: 200,
    headers: memberProfileTraceResponseHeaders(traceId),
  });
}

function resolveIngressHost(req: Request): string {
  return resolvePortalIngressHost(req);
}

function readSessionUserId(headers: Record<string, string>): string | null {
  const userId = headers["x-user-id"];
  return userId !== undefined && userId.trim().length > 0 ? userId.trim() : null;
}

async function fetchIdentityMe(host: string, headers: Record<string, string>): Promise<Response> {
  const ingressHost = host.split(":")[0] ?? host;
  return fetch(`${resolveTourOpsApiBaseUrl()}/identity/me`, {
    method: "GET",
    headers: {
      ...headers,
      host: ingressHost,
    },
    cache: "no-store",
  });
}

function resolveCacheKey(
  tenantId: string,
  userId: string,
  pluginId: string
): string {
  return buildMemberProfileCacheKey({ tenantId, userId, pluginId });
}

function enforceProfileArchitectureOrRespond(
  view: MemberProfileViewPayload,
  traceId: string
): NextResponse | null {
  const enforcement = enforceMemberProfileRuntimeTruth(
    buildMemberProfileRuntimeEnforcementContext({
      traceId,
      contractVersion: view.contractVersion,
      capabilities: view.profile.capabilities,
      responseFieldIds: Object.keys(view.profile.fields),
    })
  );
  if (!enforcement.ok) {
    return jsonMemberProfileError(enforcement.code, 500, traceId);
  }
  return null;
}

export async function GET(req: Request): Promise<NextResponse> {
  const traceId = resolveMemberProfileTraceId(req);
  runMemberProfileRuntimeTruthCheck(traceId);
  const host = resolveIngressHost(req);
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return jsonMemberProfileError("AUTH_UNAUTHENTICATED", 401, traceId);
  }

  const bootstrap = await resolvePortalBootstrapForHost(host);
  const sessionUserId = readSessionUserId(headers);
  if (sessionUserId !== null) {
    const cacheKey = resolveCacheKey(bootstrap.tenantId, sessionUserId, bootstrap.pluginId);
    const cached = readMemberProfileCache(cacheKey);
    if (cached !== null) {
      logMemberProfileEvent({
        traceId,
        kind: "profile_get",
        pluginId: bootstrap.pluginId,
        tenantId: bootstrap.tenantId,
        cache: "hit",
      });
      const enforcementResponse = enforceProfileArchitectureOrRespond(cached, traceId);
      if (enforcementResponse !== null) {
        return enforcementResponse;
      }
      return jsonMemberProfileSuccess(cached, traceId);
    }
    logMemberProfileEvent({
      traceId,
      kind: "profile_get",
      pluginId: bootstrap.pluginId,
      tenantId: bootstrap.tenantId,
      cache: "miss",
    });
  }

  let backendRes: Response;
  try {
    backendRes = await fetchIdentityMe(host, headers);
  } catch {
    return jsonMemberProfileError("BACKEND_UNREACHABLE", 502, traceId);
  }

  const payload = (await backendRes.json().catch(() => ({}))) as IdentityMeUpstream & {
    code?: unknown;
  };
  if (!backendRes.ok) {
    const code = typeof payload.code === "string" ? payload.code : "PROFILE_FETCH_FAILED";
    return jsonMemberProfileError(code, backendRes.status, traceId);
  }

  const view = buildMemberProfileView(payload, bootstrap.pluginId, { traceId });
  if (!("ok" in view)) {
    return jsonMemberProfileError(view.code, view.status, traceId, view.fieldErrors);
  }

  if (sessionUserId !== null) {
    const cacheKey = resolveCacheKey(view.profile.tenantId, view.profile.userId, bootstrap.pluginId);
    writeMemberProfileCache(cacheKey, view);
  }

  const enforcementResponse = enforceProfileArchitectureOrRespond(view, traceId);
  if (enforcementResponse !== null) {
    return enforcementResponse;
  }

  return jsonMemberProfileSuccess(view, traceId);
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const traceId = resolveMemberProfileTraceId(req);
  runMemberProfileRuntimeTruthCheck(traceId);
  const host = resolveIngressHost(req);
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return jsonMemberProfileError("AUTH_UNAUTHENTICATED", 401, traceId);
  }

  const bootstrap = await resolvePortalBootstrapForHost(host);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonMemberProfileError("INVALID_JSON", 400, traceId);
  }

  const parsed = parseMemberProfilePatchBody(
    normalizeMemberProfilePatchBody(body),
    bootstrap.pluginId,
    { traceId }
  );
  if (!("patch" in parsed)) {
    return jsonMemberProfileError(parsed.code, parsed.status, traceId, parsed.fieldErrors);
  }

  logMemberProfileEvent({
    traceId,
    kind: "profile_patch",
    pluginId: bootstrap.pluginId,
    tenantId: bootstrap.tenantId,
    fieldCount: Object.keys(parsed.patch).length,
  });

  let backendRes: Response;
  try {
    const ingressHost = host.split(":")[0] ?? host;
    backendRes = await fetch(`${resolveTourOpsApiBaseUrl()}/identity/me`, {
      method: "PATCH",
      headers: {
        ...headers,
        host: ingressHost,
        "content-type": "application/json",
      },
      body: JSON.stringify(parsed.patch),
      cache: "no-store",
    });
  } catch {
    return jsonMemberProfileError("BACKEND_UNREACHABLE", 502, traceId);
  }

  if (!backendRes.ok) {
    const payload = (await backendRes.json().catch(() => ({}))) as { code?: unknown };
    const code = typeof payload.code === "string" ? payload.code : "PROFILE_PATCH_FAILED";
    return jsonMemberProfileError(code, backendRes.status, traceId);
  }

  const identity = (await backendRes.json().catch(() => ({}))) as IdentityMeUpstream;
  const view = buildMemberProfileView(identity, bootstrap.pluginId, { traceId });
  if (!("ok" in view)) {
    return jsonMemberProfileError(view.code, view.status, traceId, view.fieldErrors);
  }

  const cacheKey = resolveCacheKey(view.profile.tenantId, view.profile.userId, bootstrap.pluginId);
  invalidateMemberProfileCache(cacheKey);
  invalidateMemberEntitlementsCacheForMember({
    tenantId: view.profile.tenantId,
    userId: view.profile.userId,
    pluginId: bootstrap.pluginId,
  });
  logMemberProfileEvent({
    traceId,
    kind: "cache_invalidate",
    pluginId: bootstrap.pluginId,
    tenantId: view.profile.tenantId,
  });
  writeMemberProfileCache(cacheKey, view);

  const enforcementResponse = enforceProfileArchitectureOrRespond(view, traceId);
  if (enforcementResponse !== null) {
    return enforcementResponse;
  }

  return jsonMemberProfileSuccess(view, traceId);
}
