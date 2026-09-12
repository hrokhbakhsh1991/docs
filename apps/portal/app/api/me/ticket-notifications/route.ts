import { NextResponse } from "next/server";

import { resolveTourOpsApiBaseUrl } from "@/env";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(req: Request): Promise<NextResponse> {
  const host = resolvePortalIngressHost(req);
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return NextResponse.json({ ok: false, code: "AUTH_UNAUTHENTICATED" }, { status: 401 });
  }

  const url = new URL(req.url);
  const upstream = new URL(`${resolveTourOpsApiBaseUrl()}/member/ticket-notifications`);
  upstream.search = url.search;

  const res = await fetch(upstream, { method: "GET", headers, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status, headers: PRIVATE_NO_STORE });
}
