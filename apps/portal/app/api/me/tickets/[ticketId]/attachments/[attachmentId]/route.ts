import { NextResponse } from "next/server";

import {
  localizeMemberTicketsBffError,
  readMemberTicketsBffErrorCode,
} from "@/me/tickets/classify-member-tickets-bff-error";
import { fetchTicketsUpstream } from "@/me/tickets/fetch-tickets-upstream.server";
import {
  jsonTicketsError,
  resolveMemberTicketsRouteContext,
} from "@/me/tickets/member-tickets-route-context.server";

export const dynamic = "force-dynamic";

type RouteParams = {
  readonly params: Promise<{ readonly ticketId: string; readonly attachmentId: string }>;
};

export async function PUT(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const context = await resolveMemberTicketsRouteContext(req);
  if (context instanceof NextResponse) {
    return context;
  }

  const { ticketId, attachmentId } = await params;
  const bytes = await req.arrayBuffer();
  const contentType = req.headers.get("content-type")?.trim() ?? "application/octet-stream";

  let upstream: Response;
  try {
    upstream = await fetchTicketsUpstream(
      context.host,
      `/member/tickets/${ticketId}/attachments/${attachmentId}/upload`,
      {
        method: "PUT",
        body: bytes,
        contentType,
      },
    );
  } catch {
    return jsonTicketsError("BACKEND_UNREACHABLE", 502);
  }

  if (!upstream.ok) {
    const errorBody = await upstream.json().catch(() => ({}));
    const code = readMemberTicketsBffErrorCode(errorBody) ?? "TICKET_ATTACHMENT_UPLOAD_FAILED";
    return jsonTicketsError(code, upstream.status, localizeMemberTicketsBffError(code, code));
  }

  return NextResponse.json(await upstream.json().catch(() => ({ ok: true })), {
    status: 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const context = await resolveMemberTicketsRouteContext(req);
  if (context instanceof NextResponse) {
    return context;
  }

  const { ticketId, attachmentId } = await params;
  let upstream: Response;
  try {
    upstream = await fetchTicketsUpstream(
      context.host,
      `/member/tickets/${ticketId}/attachments/${attachmentId}`,
    );
  } catch {
    return jsonTicketsError("BACKEND_UNREACHABLE", 502);
  }

  if (!upstream.ok) {
    const errorBody = await upstream.json().catch(() => ({}));
    const code = readMemberTicketsBffErrorCode(errorBody) ?? "TICKET_ATTACHMENT_NOT_FOUND";
    return jsonTicketsError(code, upstream.status, localizeMemberTicketsBffError(code, code));
  }

  return NextResponse.json(await upstream.json(), {
    status: 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function DELETE(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const context = await resolveMemberTicketsRouteContext(req);
  if (context instanceof NextResponse) {
    return context;
  }

  const { ticketId, attachmentId } = await params;
  let upstream: Response;
  try {
    upstream = await fetchTicketsUpstream(
      context.host,
      `/member/tickets/${ticketId}/attachments/${attachmentId}`,
      { method: "DELETE" },
    );
  } catch {
    return jsonTicketsError("BACKEND_UNREACHABLE", 502);
  }

  if (!upstream.ok) {
    const errorBody = await upstream.json().catch(() => ({}));
    const code = readMemberTicketsBffErrorCode(errorBody) ?? "TICKET_ATTACHMENT_DELETE_FAILED";
    return jsonTicketsError(code, upstream.status, localizeMemberTicketsBffError(code, code));
  }

  return NextResponse.json(await upstream.json().catch(() => ({ ok: true })), {
    status: 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}
