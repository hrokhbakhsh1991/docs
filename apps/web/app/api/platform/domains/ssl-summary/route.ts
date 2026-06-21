import { NextResponse } from "next/server";
import { proxyPlatformApi } from "@/platform/proxy-platform-api.server";

export async function GET(req: Request): Promise<NextResponse> {
  const upstream = await proxyPlatformApi(req, "/platform/v1/domains/ssl-summary");
  const body = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(body, { status: upstream.status });
}
