import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";

import type { OperatorTicketDetailHttp } from "@app-tour/ticketing-http-contracts";

import { buildOperatorTicketDetailView } from "@/features/tickets/operator-tickets-bff.server";
import { readOperatorTicketsBffErrorCode } from "@/features/tickets/classify-operator-tickets-bff-error";
import {
  jsonTicketsBffError,
  proxyTicketsApiRequest,
  readTicketsIdempotencyKey,
} from "@/features/tickets/proxy-tickets-api.server";

export const dynamic = "force-dynamic";

type BulkUpstreamResponse = {
  readonly results: ReadonlyArray<{
    readonly ticketId: string;
    readonly ok: boolean;
    readonly code?: string;
    readonly ticket?: OperatorTicketDetailHttp;
  }>;
  readonly succeeded: number;
  readonly failed: number;
};

export async function POST(req: Request): Promise<NextResponse> {
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
      path: "/tickets/bulk",
      method: "POST",
      body,
    });
  } catch {
    return jsonTicketsBffError("BACKEND_UNREACHABLE", 502);
  }

  if (!upstream.ok) {
    const payload = await upstream.json().catch(() => ({}));
    const code = readOperatorTicketsBffErrorCode(payload) ?? "TICKET_BULK_FAILED";
    return jsonTicketsBffError(code, upstream.status);
  }

  const mutation = (await upstream.json()) as BulkUpstreamResponse;
  const locale = await getLocale();
  const response = {
    ok: true as const,
    succeeded: mutation.succeeded,
    failed: mutation.failed,
    results: mutation.results.map((entry) => ({
      ticketId: entry.ticketId,
      ok: entry.ok,
      ...(entry.code !== undefined ? { code: entry.code } : {}),
      ...(entry.ticket !== undefined
        ? { detail: buildOperatorTicketDetailView(entry.ticket, locale) }
        : {}),
    })),
  };
  return NextResponse.json(response, { status: upstream.status });
}
