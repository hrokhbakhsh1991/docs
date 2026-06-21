import { NextResponse } from "next/server";

import { proxyPlatformApi } from "@/platform/proxy-platform-api.server";

type RouteContext = { params: Promise<{ id: string; domainId: string }> };

export async function DELETE(req: Request, context: RouteContext): Promise<NextResponse> {
  const { id, domainId } = await context.params;
  const upstream = await proxyPlatformApi(req, `/platform/v1/tenants/${id}/domains/${domainId}`, {
    method: "DELETE",
  });
  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 });
  }
  const body = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(body, { status: upstream.status });
}
