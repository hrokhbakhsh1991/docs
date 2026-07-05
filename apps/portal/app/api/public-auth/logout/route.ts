import { NextResponse } from "next/server";

import { clearSessionCookieOnResponse } from "@/auth/build-session-cookie";
import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import {
  invalidateMemberEntitlementsCacheForMember,
} from "@/me/member-entitlements-cache.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

/** Member session logout — clears `atour_mb_session` only (no API revoke). */
export async function POST(req: Request): Promise<NextResponse> {
  const host = resolvePortalIngressHost(req);
  try {
    const session = await readPublicCatalogSessionFromCookies();
    if (session !== null) {
      const bootstrap = await resolvePortalBootstrapForHost(host);
      invalidateMemberEntitlementsCacheForMember({
        tenantId: bootstrap.tenantId,
        userId: session.userId,
        pluginId: bootstrap.pluginId,
      });
    }
  } catch {
    // cookies()/bootstrap unavailable in unit tests or edge cases — cookie clear still proceeds.
  }

  const res = NextResponse.json({ ok: true });
  clearSessionCookieOnResponse(res.headers, host);
  return res;
}
