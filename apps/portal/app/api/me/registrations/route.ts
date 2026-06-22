import { NextResponse } from "next/server";

import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { resolveTourOpsApiBaseUrl } from "@/env";

export async function GET(req: Request): Promise<NextResponse> {
  const host = req.headers.get("host") ?? "localhost:3003";
  const apiBase = resolveTourOpsApiBaseUrl();
  const headers = await buildMemberApiHeaders(host);

  if (headers.Authorization === undefined) {
    return NextResponse.json({ ok: false, code: "AUTH_UNAUTHENTICATED" }, { status: 401 });
  }

  const res = await fetch(`${apiBase}/bookings?view=mine&limit=50`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ ok: false, code: "MINE_FETCH_FAILED" }, { status: res.status });
  }
  return NextResponse.json({ ok: true, data: payload }, { status: 200 });
}
