import { NextResponse } from "next/server";

import { resolveTourOpsApiBaseUrl } from "@/env";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";

function resolveIngressHost(req: Request): string {
  return req.headers.get("host") ?? "localhost:3003";
}

export async function GET(req: Request): Promise<NextResponse> {
  const host = resolveIngressHost(req);
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return NextResponse.json({ ok: false, code: "AUTH_UNAUTHENTICATED" }, { status: 401 });
  }

  const ingressHost = host.split(":")[0] ?? host;

  try {
    const backendRes = await fetch(`${resolveTourOpsApiBaseUrl()}/identity/me/avatar/url`, {
      method: "GET",
      headers: { ...headers, host: ingressHost },
      cache: "no-store",
    });
    if (backendRes.status === 404) {
      return NextResponse.json({ url: null }, { status: 200 });
    }
    const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(payload, { status: backendRes.status });
  } catch {
    return NextResponse.json({ ok: false, code: "BACKEND_UNREACHABLE" }, { status: 502 });
  }
}
