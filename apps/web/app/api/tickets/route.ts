import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";

import type { PaginatedOperatorTicketListHttp } from "@app-tour/ticketing-http-contracts";

import {
  buildOperatorTicketListView,
  type OperatorTicketsBffPayload,
} from "@/features/tickets/operator-tickets-bff.server";
import {
  classifyOperatorTicketsBffFailure,
  localizeOperatorTicketsBffError,
  readOperatorTicketsBffErrorCode,
} from "@/features/tickets/classify-operator-tickets-bff-error";
import { buildOperatorTicketsApiQuery } from "@/features/tickets/operator-tickets-command-center-logic";
import { parseOperatorTicketsCommandCenterQuery } from "@/features/tickets/operator-tickets-command-center-logic";
import {
  jsonTicketsBffError,
  proxyTicketsApiGet,
} from "@/features/tickets/proxy-tickets-api.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const query = parseOperatorTicketsCommandCenterQuery(url.searchParams);
  const apiQuery = buildOperatorTicketsApiQuery(query);

  let upstream: Response;
  try {
    upstream = await proxyTicketsApiGet(req, `/tickets?${apiQuery}`);
  } catch {
    return jsonTicketsBffError("BACKEND_UNREACHABLE", 502);
  }

  if (!upstream.ok) {
    const body = await upstream.json().catch(() => ({}));
    const code = readOperatorTicketsBffErrorCode(body) ?? "TICKET_LIST_FAILED";
    const failure = classifyOperatorTicketsBffFailure(upstream.status, code);
    if (failure === "module_disabled") {
      return jsonTicketsBffError(
        code,
        upstream.status,
        localizeOperatorTicketsBffError(code, code),
      );
    }
    return jsonTicketsBffError(code, upstream.status);
  }

  const page = (await upstream.json()) as PaginatedOperatorTicketListHttp;
  const locale = await getLocale();
  const payload: OperatorTicketsBffPayload = {
    ok: true,
    list: buildOperatorTicketListView(page, locale),
  };
  return NextResponse.json(payload, {
    status: 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}
