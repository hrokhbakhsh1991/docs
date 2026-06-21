import { NextResponse } from "next/server";

import { proxyPlatformApi } from "@/platform/proxy-platform-api.server";

export async function GET(req: Request): Promise<NextResponse> {
  const incoming = new URL(req.url);
  const query = incoming.searchParams.toString();
  const path = query.length > 0 ? `/platform/v1/workspaces?${query}` : "/platform/v1/workspaces";
  const upstream = await proxyPlatformApi(req, path);
  const body = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(body, { status: upstream.status });
}
