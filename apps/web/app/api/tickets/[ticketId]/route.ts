import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";

import type { OperatorTicketDetailHttp } from "@app-tour/ticketing-http-contracts";

import {
  buildOperatorTicketDetailView,
  type OperatorTicketDetailBffPayload,
  type OperatorTicketMutationBffPayload,
} from "@/features/tickets/operator-tickets-bff.server";
import {
  classifyOperatorTicketsBffFailure,
  readOperatorTicketsBffErrorCode,
} from "@/features/tickets/classify-operator-tickets-bff-error";
import {
  jsonTicketsBffError,
  proxyTicketsApiGet,
  proxyTicketsApiRequest,
  readTicketsIdempotencyKey,
} from "@/features/tickets/proxy-tickets-api.server";

export const dynamic = "force-dynamic";

type RouteParams = { readonly params: Promise<{ readonly ticketId: string }> };

export async function GET(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const { ticketId } = await params;
  let upstream: Response;
  try {
    upstream = await proxyTicketsApiGet(req, `/tickets/${ticketId}`);
  } catch {
    return jsonTicketsBffError("BACKEND_UNREACHABLE", 502);
  }

  if (!upstream.ok) {
    const body = await upstream.json().catch(() => ({}));
    const code = readOperatorTicketsBffErrorCode(body) ?? "TICKET_DETAIL_FAILED";
    classifyOperatorTicketsBffFailure(upstream.status, code);
    return jsonTicketsBffError(code, upstream.status);
  }

  const detailHttp = (await upstream.json()) as OperatorTicketDetailHttp;
  const locale = await getLocale();
  const payload: OperatorTicketDetailBffPayload = {
    ok: true,
    detail: buildOperatorTicketDetailView(detailHttp, locale),
  };
  return NextResponse.json(payload, {
    status: 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PATCH(req: Request, { params }: RouteParams): Promise<NextResponse> {
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
      path: `/tickets/${ticketId}`,
      method: "PATCH",
      body,
    });
  } catch {
    return jsonTicketsBffError("BACKEND_UNREACHABLE", 502);
  }

  if (!upstream.ok) {
    const payload = await upstream.json().catch(() => ({}));
    const code = readOperatorTicketsBffErrorCode(payload) ?? "TICKET_PATCH_FAILED";
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
