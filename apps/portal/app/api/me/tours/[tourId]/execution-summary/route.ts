import { NextResponse } from "next/server";

import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { resolveTourOpsApiBaseUrl } from "@/env";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

type RouteContext = { params: Promise<{ tourId: string }> };

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const host = resolvePortalIngressHost(req);
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return NextResponse.json({ ok: false, code: "AUTH_UNAUTHENTICATED" }, { status: 401 });
  }
  const { tourId } = await context.params;
  const trimmed = tourId.trim();
  if (trimmed.length === 0) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD" }, { status: 400 });
  }
  const res = await fetch(
    `${resolveTourOpsApiBaseUrl()}/member/tours/${encodeURIComponent(trimmed)}/execution-summary`,
    { method: "GET", headers, cache: "no-store" },
  );
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: typeof payload.code === "string" ? payload.code : "unknown_error" },
      { status: res.status },
    );
  }
  return NextResponse.json({ ok: true, data: payload }, { status: 200 });
}
