import { NextResponse } from "next/server";

import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

type RouteContext = { readonly params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json({ error: { code: "AUTH_UNAUTHENTICATED" } }, { status: 401 });
  }
  const apiBase = resolveTourOpsApiBaseUrl();
  const incoming = new URL(req.url);
  const backendRes = await fetch(`${apiBase}/tours/${encodeURIComponent(id)}/driver-settlements`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      host: incoming.host.split(":")[0] ?? "localhost",
    },
    cache: "no-store",
  });
  const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: backendRes.status });
}
