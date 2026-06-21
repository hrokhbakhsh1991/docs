import { NextResponse } from "next/server";

import { proxyPlatformApi } from "@/platform/proxy-platform-api.server";

export async function GET(req: Request): Promise<NextResponse> {
  const incoming = new URL(req.url);
  const query = incoming.searchParams.toString();
  const path = query.length > 0 ? `/platform/v1/tenants?${query}` : "/platform/v1/tenants";
  const upstream = await proxyPlatformApi(req, path);
  const body = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(body, { status: upstream.status });
}

export async function POST(req: Request): Promise<NextResponse> {
  const rawBody = await req.text();
  const headers = new Headers();
  const idempotencyKey = req.headers.get("Idempotency-Key");
  if (idempotencyKey) {
    headers.set("Idempotency-Key", idempotencyKey);
  }
  const upstream = await proxyPlatformApi(req, "/platform/v1/tenants", {
    method: "POST",
    headers,
    body: rawBody,
  });
  const body = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(body, { status: upstream.status });
}
