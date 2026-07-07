import { NextResponse } from "next/server";

import { proxyPlatformApi } from "@/platform/proxy-platform-api.server";

type RouteContext = { params: Promise<{ id: string; version: string }> };

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const { id, version } = await context.params;
  const upstream = await proxyPlatformApi(
    req,
    `/platform/v1/workspace-definitions/${id}/versions/${version}`
  );
  const body = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(body, { status: upstream.status });
}
