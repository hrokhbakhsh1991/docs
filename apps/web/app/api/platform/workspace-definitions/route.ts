import { NextResponse } from "next/server";

import { proxyPlatformApi } from "@/platform/proxy-platform-api.server";

export async function GET(req: Request): Promise<NextResponse> {
  const upstream = await proxyPlatformApi(req, "/platform/v1/workspace-definitions");
  const body = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(body, { status: upstream.status });
}

export async function POST(req: Request): Promise<NextResponse> {
  const rawBody = await req.text();
  const upstream = await proxyPlatformApi(req, "/platform/v1/workspace-definitions", {
    method: "POST",
    body: rawBody,
  });
  const body = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(body, { status: upstream.status });
}
