import { NextResponse } from "next/server";

import { proxyTicketsApiGet } from "@/features/tickets/proxy-tickets-api.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const upstream = await proxyTicketsApiGet(req, "/ticket-templates");
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
