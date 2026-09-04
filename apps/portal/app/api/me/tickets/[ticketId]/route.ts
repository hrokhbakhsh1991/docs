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
import { fetchTicketsUpstream } from "@/me/tickets/fetch-tickets-upstream.server";
import {
  jsonTicketsError,
  resolveMemberTicketsRouteContext,
} from "@/me/tickets/member-tickets-route-context.server";

export const dynamic = "force-dynamic";

type RouteParams = { readonly params: Promise<{ readonly ticketId: string }> };

export async function GET(req: Request, { params }: RouteParams): Promise<NextResponse> {
  const context = await resolveMemberTicketsRouteContext(req);
  if (context instanceof NextResponse) {
    return context;
  }

  const { ticketId } = await params;
  let upstream: Response;
  try {
    upstream = await fetchTicketsUpstream(context.host, `/member/tickets/${ticketId}`);
  } catch {
    return jsonTicketsError("BACKEND_UNREACHABLE", 502);
  }

  if (!upstream.ok) {
    const body = await upstream.json().catch(() => ({}));
    const code = readMemberTicketsBffErrorCode(body) ?? "TICKET_NOT_FOUND";
    return jsonTicketsError(
      code,
      upstream.status,
      localizeMemberTicketsBffError(code, "Ticket not found"),
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
