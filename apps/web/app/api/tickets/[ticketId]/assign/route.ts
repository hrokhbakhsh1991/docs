import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";

import type { OperatorTicketDetailHttp } from "@app-tour/ticketing-http-contracts";

import {
  buildOperatorTicketDetailView,
  type OperatorTicketMutationBffPayload,
} from "@/features/tickets/operator-tickets-bff.server";
import { readOperatorTicketsBffErrorCode } from "@/features/tickets/classify-operator-tickets-bff-error";
import {
  jsonTicketsBffError,
  proxyTicketsApiRequest,
  readTicketsIdempotencyKey,
} from "@/features/tickets/proxy-tickets-api.server";

export const dynamic = "force-dynamic";

type RouteParams = { readonly params: Promise<{ readonly ticketId: string }> };

export async function POST(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const { ticketId } = await params;
  const idempotencyKey = readTicketsIdempotencyKey(req);
  if (idempotencyKey === undefined) {
    return jsonTicketsBffError("IDEMPOTENCY_KEY_REQUIRED", 422);
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return jsonTicketsBffError("ZOD_VALIDATION_FAILED", 422);
  }

  let upstream: Response;
  try {
    upstream = await proxyTicketsApiRequest(req, {
      path: `/tickets/${ticketId}/assign`,
      method: "POST",
      body,
    });
  } catch {
    return jsonTicketsBffError("BACKEND_UNREACHABLE", 502);
  }

  if (!upstream.ok) {
    const payload = await upstream.json().catch(() => ({}));
    const code = readOperatorTicketsBffErrorCode(payload) ?? "TICKET_ASSIGN_FAILED";
    return jsonTicketsBffError(code, upstream.status);
  }

  const mutation = (await upstream.json()) as { readonly ticket: OperatorTicketDetailHttp };
  const locale = await getLocale();
  const response: OperatorTicketMutationBffPayload = {
    ok: true,
    detail: buildOperatorTicketDetailView(mutation.ticket, locale),
  };
  return NextResponse.json(response, { status: upstream.status });
}
