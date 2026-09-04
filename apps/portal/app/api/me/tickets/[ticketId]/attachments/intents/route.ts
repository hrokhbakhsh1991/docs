import { NextResponse } from "next/server";

import {
  localizeMemberTicketsBffError,
  readMemberTicketsBffErrorCode,
} from "@/me/tickets/classify-member-tickets-bff-error";
import { fetchTicketsUpstream, readIdempotencyKey } from "@/me/tickets/fetch-tickets-upstream.server";
import {
  jsonTicketsError,
  resolveMemberTicketsRouteContext,
} from "@/me/tickets/member-tickets-route-context.server";

export const dynamic = "force-dynamic";

type RouteParams = { readonly params: Promise<{ readonly ticketId: string }> };

export async function POST(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const context = await resolveMemberTicketsRouteContext(req);
  if (context instanceof NextResponse) {
    return context;
  }

  const { ticketId } = await params;
  const idempotencyKey = readIdempotencyKey(req);
  if (idempotencyKey === undefined) {
    return jsonTicketsError("IDEMPOTENCY_KEY_REQUIRED", 422);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonTicketsError("ZOD_VALIDATION_FAILED", 422);
  }

  let upstream: Response;
  try {
    upstream = await fetchTicketsUpstream(
      context.host,
      `/member/tickets/${ticketId}/attachments/intents`,
      { method: "POST", body, idempotencyKey },
    );
  } catch {
    return jsonTicketsError("BACKEND_UNREACHABLE", 502);
  }

  if (!upstream.ok) {
    const errorBody = await upstream.json().catch(() => ({}));
    const code = readMemberTicketsBffErrorCode(errorBody) ?? "TICKET_ATTACHMENT_INTENT_FAILED";
    return jsonTicketsError(code, upstream.status, localizeMemberTicketsBffError(code, code));
  }

  return NextResponse.json(await upstream.json(), {
    status: 201,
    headers: { "Cache-Control": "private, no-store" },
  });
}
