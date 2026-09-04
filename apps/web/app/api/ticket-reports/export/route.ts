import { NextResponse } from "next/server";

import { proxyTicketsApiGet } from "@/features/tickets/proxy-tickets-api.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const upstream = await proxyTicketsApiGet(req, "/ticket-reports/export");
  if (!upstream.ok) {
    const body = await upstream.json().catch(() => ({}));
    return NextResponse.json(body, { status: upstream.status });
  }
  const contentType = upstream.headers.get("content-type") ?? "application/json";
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
    },
  });
}
