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
  proxyTicketsApiGet,
  proxyTicketsApiRequest,
  readTicketsIdempotencyKey,
} from "@/features/tickets/proxy-tickets-api.server";

export const dynamic = "force-dynamic";

type RouteParams = { readonly params: Promise<{ readonly ticketId: string }> };

async function mutationWithDetailRefresh(
  req: Request,
  ticketId: string,
  path: string,
  body: string,
): Promise<NextResponse> {
  const idempotencyKey = readTicketsIdempotencyKey(req);
  if (idempotencyKey === undefined) {
    return jsonTicketsBffError("IDEMPOTENCY_KEY_REQUIRED", 422);
  }

  let upstream: Response;
  try {
    upstream = await proxyTicketsApiRequest(req, { path, method: "POST", body });
  } catch {
    return jsonTicketsBffError("BACKEND_UNREACHABLE", 502);
  }

  if (!upstream.ok) {
    const payload = await upstream.json().catch(() => ({}));
    const code = readOperatorTicketsBffErrorCode(payload) ?? "TICKET_MUTATION_FAILED";
    return jsonTicketsBffError(code, upstream.status);
  }

  const mutationBody = (await upstream.json().catch(() => null)) as {
    readonly ticket?: OperatorTicketDetailHttp;
  } | null;
  const locale = await getLocale();
  if (mutationBody?.ticket !== undefined) {
    const payload: OperatorTicketMutationBffPayload = {
      ok: true,
      detail: buildOperatorTicketDetailView(mutationBody.ticket, locale),
    };
    return NextResponse.json(payload, { status: upstream.status });
  }

  const detailRes = await proxyTicketsApiGet(req, `/tickets/${ticketId}`);
  if (!detailRes.ok) {
    const errBody = await detailRes.json().catch(() => ({}));
    const code = readOperatorTicketsBffErrorCode(errBody) ?? "TICKET_DETAIL_FAILED";
    return jsonTicketsBffError(code, detailRes.status);
  }
  const detailHttp = (await detailRes.json()) as OperatorTicketDetailHttp;
  const payload: OperatorTicketMutationBffPayload = {
    ok: true,
    detail: buildOperatorTicketDetailView(detailHttp, locale),
  };
  return NextResponse.json(payload, { status: upstream.status });
}

export async function POST(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const { ticketId } = await params;
  let body: string;
  try {
    body = await req.text();
  } catch {
    return jsonTicketsBffError("ZOD_VALIDATION_FAILED", 422);
  }
  return mutationWithDetailRefresh(req, ticketId, `/tickets/${ticketId}/reopen`, body);
}
