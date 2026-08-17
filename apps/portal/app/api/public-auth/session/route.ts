import { NextResponse } from "next/server";

import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import { sessionMemberMatchesPortalTenant } from "@/tenant/session-host-binding";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

/**
 * PCMS-CORS-05 — boolean cookie probe for a future Marketing Portal-origin adapter.
 * No profile PII, no session token. Fail-closed to `ready: false`.
 */
export async function GET(req: Request): Promise<NextResponse> {
  let ready = false;
  try {
    const session = await readPublicCatalogSessionFromCookies();
    if (session !== null) {
      const host = resolvePortalIngressHost(req);
      const bootstrap = await resolvePortalBootstrapForHost(host);
      ready = sessionMemberMatchesPortalTenant(session.tenantId, bootstrap.tenantId);
    }
  } catch {
    ready = false;
  }

  return NextResponse.json({ ok: true, ready });
}
