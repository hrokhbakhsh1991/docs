import { NextResponse } from "next/server";

import { proxyTicketsApiGet } from "@/features/tickets/proxy-tickets-api.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const upstream = await proxyTicketsApiGet(req, "/ticket-reports/summary");
  const body = await upstream.json().catch(() => ({}));
  return NextResponse.json(body, { status: upstream.status });
}
