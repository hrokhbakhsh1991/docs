import { NextResponse } from "next/server";

import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import {
  buildMemberEntitlementsCacheKey,
  readMemberEntitlementsCache,
  resolveMemberEntitlementsCacheControlHeader,
  writeMemberEntitlementsCache,
} from "@/me/member-entitlements-cache.server";
import { resolveMemberEntitlementsPayload } from "@/me/member-entitlements-bff.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

export const dynamic = "force-dynamic";

function jsonError(code: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, code }, { status });
}

function readSessionUserId(headers: Record<string, string>): string | null {
  const userId = headers["x-user-id"];
  return userId !== undefined && userId.trim().length > 0 ? userId.trim() : null;
}

export async function GET(req: Request): Promise<NextResponse> {
  const host = resolvePortalIngressHost(req);
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return jsonError("unauthorized", 401);
  }

  const bootstrap = await resolvePortalBootstrapForHost(host);
  if (headers["x-tenant-id"] !== bootstrap.tenantId) {
    return jsonError("tenant_mismatch", 403);
  }

  const sessionUserId = readSessionUserId(headers);
  const cacheControl = resolveMemberEntitlementsCacheControlHeader();
  const cacheKey =
    sessionUserId !== null
      ? buildMemberEntitlementsCacheKey({
          tenantId: bootstrap.tenantId,
          userId: sessionUserId,
          pluginId: bootstrap.pluginId,
        })
      : null;

  if (cacheKey !== null) {
    const cached = readMemberEntitlementsCache(cacheKey);
    if (cached !== null) {
      return NextResponse.json(cached, {
        status: 200,
        headers: { "Cache-Control": cacheControl },
      });
    }
  }

  const result = await resolveMemberEntitlementsPayload({
    host,
    tenantId: bootstrap.tenantId,
    pluginId: bootstrap.pluginId,
    apiHeaders: headers,
  });

  if (result.auth === "unauthenticated") {
    return jsonError("unauthorized", 401);
  }

  if (cacheKey !== null && result.cacheable) {
    writeMemberEntitlementsCache(cacheKey, result.payload);
  }

  return NextResponse.json(result.payload, {
    status: 200,
    headers: { "Cache-Control": cacheControl },
  });
}
