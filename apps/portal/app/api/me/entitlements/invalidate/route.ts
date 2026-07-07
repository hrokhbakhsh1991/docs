import { NextResponse } from "next/server";

import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { invalidateMemberEntitlementsCacheForMember } from "@/me/member-entitlements-cache.server";
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

/** Session-scoped entitlements BFF cache bust (PS-6 bootstrap for BP-7 webhooks). */
export async function POST(req: Request): Promise<NextResponse> {
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
  if (sessionUserId === null) {
    return jsonError("unauthorized", 401);
  }

  invalidateMemberEntitlementsCacheForMember({
    tenantId: bootstrap.tenantId,
    userId: sessionUserId,
    pluginId: bootstrap.pluginId,
  });

  return NextResponse.json(
    { ok: true, invalidated: true },
    { status: 200, headers: { "Cache-Control": "private, no-store" } }
  );
}
