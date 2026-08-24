import { NextResponse } from "next/server";

import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

type RouteContext = { readonly params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json({ error: { code: "AUTH_UNAUTHENTICATED" } }, { status: 401 });
  }
  const body = await req.text();
  const apiBase = resolveTourOpsApiBaseUrl();
  const incoming = new URL(req.url);
  const backendRes = await fetch(`${apiBase}/tours/${encodeURIComponent(id)}/roster/freeze`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      host: incoming.host.split(":")[0] ?? "localhost",
      "Content-Type": "application/json",
    },
    body,
    cache: "no-store",
  });
  const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: backendRes.status });
}
