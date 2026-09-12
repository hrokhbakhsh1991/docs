import { NextResponse } from "next/server";

import { proxyTicketsApiRequest } from "@/features/tickets/proxy-tickets-api.server";

export const dynamic = "force-dynamic";

type RouteParams = { readonly params: Promise<{ readonly code: string }> };

export async function POST(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const { code } = await params;
  const incoming = new URL(req.url);
  const query = incoming.searchParams.toString();
  const path =
    query.length > 0
      ? `/ticket-templates/${encodeURIComponent(code)}/preview?${query}`
      : `/ticket-templates/${encodeURIComponent(code)}/preview`;

  let body: string | undefined;
  try {
    const text = await req.text();
    body = text.length > 0 ? text : "{}";
  } catch {
    body = "{}";
  }

  const upstream = await proxyTicketsApiRequest(req, {
    path,
    method: "POST",
    body,
  });
  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}
