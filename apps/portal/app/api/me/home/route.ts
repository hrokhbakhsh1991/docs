import { NextResponse } from "next/server";

import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { buildMemberHomePayload } from "@/me/member-home-bff.server";
import { resolveMemberEntitlementsPayload } from "@/me/member-entitlements-bff.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

export const dynamic = "force-dynamic";

function jsonError(code: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, code }, { status });
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

  const entitlements = await resolveMemberEntitlementsPayload({
    host,
    tenantId: bootstrap.tenantId,
    pluginId: bootstrap.pluginId,
    apiHeaders: headers,
  });
  if (entitlements.auth === "unauthenticated") {
    return jsonError("unauthorized", 401);
  }

  return NextResponse.json(
    buildMemberHomePayload({
      tenantId: bootstrap.tenantId,
      pluginId: bootstrap.pluginId,
      grantedEntitlementKeys: entitlements.payload.granted,
    }),
    { status: 200, headers: { "Cache-Control": "private, no-store" } }
  );
}
