import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";

import type { PaginatedMemberTicketListHttp } from "@app-tour/ticketing-http-contracts";

import {
  buildMemberTicketListView,
  type MemberTicketsBffPayload,
} from "@/me/tickets/member-tickets-bff.server";
import {
  classifyMemberTicketsBffFailure,
  localizeMemberTicketsBffError,
  readMemberTicketsBffErrorCode,
} from "@/me/tickets/classify-member-tickets-bff-error";
import { fetchTicketsUpstream, readIdempotencyKey } from "@/me/tickets/fetch-tickets-upstream.server";
import {
  jsonTicketsError,
  resolveMemberTicketsRouteContext,
} from "@/me/tickets/member-tickets-route-context.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const context = await resolveMemberTicketsRouteContext(req);
  if (context instanceof NextResponse) {
    return context;
  }

  const url = new URL(req.url);
  const query: Record<string, string> = {};
  const status = url.searchParams.get("status");
  const cursor = url.searchParams.get("cursor");
  const limit = url.searchParams.get("limit");
  if (status !== null && status.trim().length > 0) {
    query.status = status.trim();
  }
  if (cursor !== null && cursor.trim().length > 0) {
    query.cursor = cursor.trim();
  }
  if (limit !== null && limit.trim().length > 0) {
    query.limit = limit.trim();
  }

  let upstream: Response;
  try {
    upstream = await fetchTicketsUpstream(context.host, "/member/tickets", { query });
  } catch {
    return jsonTicketsError("BACKEND_UNREACHABLE", 502);
  }

  if (!upstream.ok) {
    const body = await upstream.json().catch(() => ({}));
    const code = readMemberTicketsBffErrorCode(body) ?? "TICKET_LIST_FAILED";
    const failure = classifyMemberTicketsBffFailure(upstream.status, code);
    if (failure === "module_disabled" || failure === "workspace_disabled") {
      return jsonTicketsError(code, upstream.status, localizeMemberTicketsBffError(code, code));
    }
    return jsonTicketsError(code, upstream.status);
  }

  const page = (await upstream.json()) as PaginatedMemberTicketListHttp;
  const locale = await getLocale();
  const payload: MemberTicketsBffPayload = {
    ok: true,
    list: buildMemberTicketListView(page, locale),
  };

  return NextResponse.json(payload, {
    status: 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(req: Request): Promise<NextResponse> {
  const context = await resolveMemberTicketsRouteContext(req);
  if (context instanceof NextResponse) {
    return context;
  }

  const idempotencyKey = readIdempotencyKey(req);
  if (idempotencyKey === undefined) {
    return jsonTicketsError(
      "IDEMPOTENCY_KEY_REQUIRED",
      422,
      localizeMemberTicketsBffError("IDEMPOTENCY_KEY_REQUIRED", "Idempotency key required"),
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonTicketsError("ZOD_VALIDATION_FAILED", 422);
  }

  let upstream: Response;
  try {
    upstream = await fetchTicketsUpstream(context.host, "/member/tickets", {
      method: "POST",
      body,
      idempotencyKey,
    });
  } catch {
    return jsonTicketsError("BACKEND_UNREACHABLE", 502);
  }

  if (!upstream.ok) {
    const errorBody = await upstream.json().catch(() => ({}));
    const code = readMemberTicketsBffErrorCode(errorBody) ?? "TICKET_CREATE_FAILED";
    return jsonTicketsError(
      code,
      upstream.status,
      localizeMemberTicketsBffError(code, "Create ticket failed"),
    );
  }

  const created = await upstream.json();
  return NextResponse.json(created, {
    status: 201,
    headers: { "Cache-Control": "private, no-store" },
  });
}
