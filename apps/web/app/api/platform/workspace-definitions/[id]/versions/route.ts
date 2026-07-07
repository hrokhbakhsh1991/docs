import { NextResponse } from "next/server";

import { proxyPlatformApi } from "@/platform/proxy-platform-api.server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  const rawBody = await req.text();
  const upstream = await proxyPlatformApi(req, `/platform/v1/workspace-definitions/${id}/versions`, {
    method: "POST",
    body: rawBody,
  });
  const body = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(body, { status: upstream.status });
}
