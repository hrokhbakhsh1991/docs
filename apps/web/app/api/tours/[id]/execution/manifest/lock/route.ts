import { NextResponse } from "next/server";

import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

type RouteContext = { readonly params: Promise<{ id: string }> };

async function proxyPost(req: Request, tourId: string, suffix: string): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json({ error: { code: "AUTH_UNAUTHENTICATED" } }, { status: 401 });
  }
  const apiBase = resolveTourOpsApiBaseUrl();
  const incoming = new URL(req.url);
  const backendRes = await operatorApiFetch(
    `${apiBase}/tours/${encodeURIComponent(tourId)}/execution${suffix}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host: incoming.host.split(":")[0] ?? "localhost",
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    },
  );
  const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: backendRes.status });
}

export async function POST(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxyPost(req, id, "/manifest/lock");
}
