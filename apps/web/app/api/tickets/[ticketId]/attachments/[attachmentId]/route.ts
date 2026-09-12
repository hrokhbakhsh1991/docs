import { NextResponse } from "next/server";

import {
  jsonTicketsBffError,
  proxyTicketsApiGet,
} from "@/features/tickets/proxy-tickets-api.server";

export const dynamic = "force-dynamic";

type RouteParams = {
  readonly params: Promise<{ readonly ticketId: string; readonly attachmentId: string }>;
};

export async function GET(req: Request, { params }: RouteParams): Promise<Response> {
  const { ticketId, attachmentId } = await params;
  let upstream: Response;
  try {
    upstream = await proxyTicketsApiGet(
      req,
      `/tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(attachmentId)}`
    );
  } catch {
    return jsonTicketsBffError("BACKEND_UNREACHABLE", 502);
  }
  if (!upstream.ok) {
    return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status });
  }
  const payload = (await upstream.json().catch(() => null)) as { readonly readUrl?: string } | null;
  if (payload === null || typeof payload.readUrl !== "string" || payload.readUrl.length === 0) {
    return jsonTicketsBffError("TICKET_ATTACHMENT_NOT_FOUND", 502);
  }
  return NextResponse.redirect(new URL(payload.readUrl, req.url), 302);
}
