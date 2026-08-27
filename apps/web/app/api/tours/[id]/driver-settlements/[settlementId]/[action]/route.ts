import { NextResponse } from "next/server";

import { operatorApiFetch } from "@/auth/operator-api-fetch";

import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

type RouteContext = { readonly params: Promise<{ id: string; settlementId: string; action: string }> };

export async function POST(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { id, settlementId, action } = await ctx.params;
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json({ error: { code: "AUTH_UNAUTHENTICATED" } }, { status: 401 });
  }
  const body = await req.text();
  const apiBase = resolveTourOpsApiBaseUrl();
  const incoming = new URL(req.url);
  const backendRes = await operatorApiFetch(
    `${apiBase}/tours/${encodeURIComponent(id)}/driver-settlements/${encodeURIComponent(settlementId)}/${action}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host: incoming.host.split(":")[0] ?? "localhost",
        "Content-Type": "application/json",
      },
      body: body.length > 0 ? body : "{}",
      cache: "no-store",
    }
  );
  const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: backendRes.status });
}
