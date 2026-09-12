import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";

import type { MemberTicketDetailHttp } from "@app-tour/ticketing-http-contracts";

import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import {
  buildMemberTicketDetailView,
  type MemberTicketDetailBffPayload,
} from "@/me/tickets/member-tickets-bff.server";
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
    return jsonTicketsError(
      "IDEMPOTENCY_KEY_REQUIRED",
      422,
      localizeMemberTicketsBffError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency key required"),
    );
  }

  let body: unknown = {};
  try {
    const raw = await req.text();
    if (raw.trim().length > 0) {
      body = JSON.parse(raw) as unknown;
    }
  } catch {
    return jsonTicketsError("ZOD_VALIDATION_FAILED", 422);
  }

  let upstream: Response;
  try {
    upstream = await fetchTicketsUpstream(context.host, `/member/tickets/${ticketId}/reopen`, {
      method: "POST",
      body,
      idempotencyKey,
    });
  } catch {
    return jsonTicketsError("BACKEND_UNREACHABLE", 502);
  }

  if (!upstream.ok) {
    const errorBody = await upstream.json().catch(() => ({}));
    const code = readMemberTicketsBffErrorCode(errorBody) ?? "TICKET_REOPEN_FAILED";
    return jsonTicketsError(
      code,
      upstream.status,
      localizeMemberTicketsBffError(code, "Reopen failed"),
    );
  }

  const detail = (await upstream.json()) as MemberTicketDetailHttp;
  const session = await readPublicCatalogSessionFromCookies();
  const memberUserId =
    session !== null && session.tenantId === context.bootstrap.tenantId
      ? session.userId
      : "";
  const locale = await getLocale();
  const payload: MemberTicketDetailBffPayload = {
    ok: true,
    detail: buildMemberTicketDetailView(detail, locale, memberUserId),
  };

  return NextResponse.json(payload, {
    status: 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}
