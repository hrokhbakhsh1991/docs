import { NextResponse } from "next/server";

import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { resolveTourOpsApiBaseUrl } from "@/env";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

function readSearch(req: Request, key: string): string {
  return new URL(req.url).searchParams.get(key)?.trim() ?? "";
}

export async function GET(req: Request): Promise<NextResponse> {
  const host = resolvePortalIngressHost(req);
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const tourId = readSearch(req, "tourId");
  if (tourId.length === 0) {
    return NextResponse.json({ ok: false, code: "TOUR_ID_REQUIRED" }, { status: 400 });
  }

  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return NextResponse.json({ ok: false, code: "AUTH_UNAUTHENTICATED" }, { status: 401 });
  }

  const params = new URLSearchParams({
    workspace: bootstrap.pluginId,
    tourId,
    partySize: readSearch(req, "partySize") || "1",
  });
  const transportKind = readSearch(req, "transportKind");
  if (transportKind.length > 0) {
    params.set("transportKind", transportKind);
  }

  const res = await fetch(`${resolveTourOpsApiBaseUrl()}/catalog/pricing-preview?${params}`, {
    method: "GET",
    headers: {
      ...headers,
      host: host.split(":")[0] ?? host,
    },
    cache: "no-store",
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: res.status });
}
