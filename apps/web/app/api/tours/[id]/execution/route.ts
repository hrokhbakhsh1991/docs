import { NextResponse } from "next/server";

import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

type RouteContext = { readonly params: Promise<{ id: string }> };

function unauthenticated(): NextResponse {
  return NextResponse.json({ error: { code: "AUTH_UNAUTHENTICATED" } }, { status: 401 });
}

async function proxy(req: Request, tourId: string, suffix: string, method: "GET" | "POST") {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return unauthenticated();
  }
  const apiBase = resolveTourOpsApiBaseUrl();
  const incoming = new URL(req.url);
  const backendRes = await operatorApiFetch(
    `${apiBase}/tours/${encodeURIComponent(tourId)}/execution${suffix}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host: incoming.host.split(":")[0] ?? "localhost",
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: method === "POST" ? "{}" : undefined,
      cache: "no-store",
    }
  );
  const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: backendRes.status });
}

export async function GET(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, id, "", "GET");
}

export async function POST(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, id, "/start", "POST");
}
