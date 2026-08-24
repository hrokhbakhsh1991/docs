import { NextResponse } from "next/server";

import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

type RouteContext = { readonly params: Promise<{ id: string }> };

async function proxy(
  req: Request,
  tourId: string,
  path: string,
  method: "GET" | "PUT" | "POST"
): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json({ error: { code: "AUTH_UNAUTHENTICATED" } }, { status: 401 });
  }
  const body = method === "GET" ? undefined : await req.text();
  const apiBase = resolveTourOpsApiBaseUrl();
  const incoming = new URL(req.url);
  const backendRes = await fetch(`${apiBase}/tours/${encodeURIComponent(tourId)}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      host: incoming.host.split(":")[0] ?? "localhost",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body,
    cache: "no-store",
  });
  const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: backendRes.status });
}

export async function GET(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, id, "/transport-allocations", "GET");
}

export async function PUT(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  return proxy(req, id, "/transport-allocations", "PUT");
}
