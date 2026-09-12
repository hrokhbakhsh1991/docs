import { NextResponse } from "next/server";

import { resolveTourOpsApiBaseUrl } from "@/env";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

export async function GET(req: Request): Promise<NextResponse> {
  const host = resolvePortalIngressHost(req);
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return NextResponse.json({ ok: false, code: "AUTH_UNAUTHENTICATED" }, { status: 401 });
  }

  const upstream = new URL(`${resolveTourOpsApiBaseUrl()}/member/notifications`);
  const incoming = new URL(req.url);
  for (const key of ["limit", "cursor", "unreadOnly"]) {
    const value = incoming.searchParams.get(key);
    if (value !== null) {
      upstream.searchParams.set(key, value);
    }
  }

  const res = await fetch(upstream, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
