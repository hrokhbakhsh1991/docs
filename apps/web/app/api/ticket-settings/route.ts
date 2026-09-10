import { NextResponse } from "next/server";

import {
  proxyTicketsApiGet,
  proxyTicketsApiRequest,
} from "@/features/tickets/proxy-tickets-api.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const upstream = await proxyTicketsApiGet(req, "/ticket-settings");
  const body = await upstream.json().catch(() => ({}));
  return NextResponse.json(body, { status: upstream.status });
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const payload = await req.text();
  const upstream = await proxyTicketsApiRequest(req, {
    method: "PATCH",
    path: "/ticket-settings",
    body: payload,
  });
  const body = await upstream.json().catch(() => ({}));
  return NextResponse.json(body, { status: upstream.status });
}
