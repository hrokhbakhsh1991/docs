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

async function refreshDetailBff(
  req: Request,
  ticketId: string,
  locale: string,
): Promise<OperatorTicketMutationBffPayload | NextResponse> {
  const detailRes = await proxyTicketsApiGet(req, `/tickets/${ticketId}`);
  if (!detailRes.ok) {
    const body = await detailRes.json().catch(() => ({}));
    const code = readOperatorTicketsBffErrorCode(body) ?? "TICKET_DETAIL_FAILED";
    return jsonTicketsBffError(code, detailRes.status);
  }
  const detailHttp = (await detailRes.json()) as OperatorTicketDetailHttp;
  return { ok: true, detail: buildOperatorTicketDetailView(detailHttp, locale) };
}

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
      path: `/tickets/${ticketId}/internal-notes`,
      method: "POST",
      body,
    });
  } catch {
    return jsonTicketsBffError("BACKEND_UNREACHABLE", 502);
  }

  if (!upstream.ok) {
    const payload = await upstream.json().catch(() => ({}));
    const code = readOperatorTicketsBffErrorCode(payload) ?? "TICKET_NOTE_FAILED";
    return jsonTicketsBffError(code, upstream.status);
  }

  const locale = await getLocale();
  const refreshed = await refreshDetailBff(req, ticketId, locale);
  if (refreshed instanceof NextResponse) {
    return refreshed;
  }
  return NextResponse.json(refreshed, { status: 200 });
}
