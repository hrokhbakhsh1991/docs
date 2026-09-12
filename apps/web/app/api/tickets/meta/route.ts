import { NextResponse } from "next/server";

import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import {
  buildOperatorTicketsMetaView,
  type OperatorTicketsMetaBffPayload,
} from "@/features/tickets/operator-tickets-bff.server";
import { readOperatorTicketsBffErrorCode } from "@/features/tickets/classify-operator-tickets-bff-error";
import {
  jsonTicketsBffError,
  proxyTicketsApiGet,
} from "@/features/tickets/proxy-tickets-api.server";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

export const dynamic = "force-dynamic";

type ItemsResponse<T> = { readonly items: readonly T[] };

async function fetchTicketOperators(req: Request): Promise<
  readonly { readonly userId: string; readonly label: string }[]
> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return [];
  }

  const incoming = new URL(req.url);
  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    const backendRes = await operatorApiFetch(`${apiBase}/users?limit=50`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host: incoming.host.split(":")[0] ?? "localhost",
      },
      cache: "no-store",
    });
    if (!backendRes.ok) {
      return [];
    }
    const body = (await backendRes.json()) as ItemsResponse<{
      readonly userId: string;
      readonly displayName?: string | null;
      readonly mobile?: string | null;
      readonly role: string;
    }>;
    return (body.items ?? [])
      .filter((item) => item.role === "admin" || item.role === "owner")
      .map((item) => ({
        userId: item.userId,
        label: item.displayName?.trim() || item.mobile?.trim() || item.userId.slice(0, 8),
      }));
  } catch {
    return [];
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  const [categoriesRes, queuesRes, teamsRes, tagsRes, operators] = await Promise.all([
    proxyTicketsApiGet(req, "/ticket-categories"),
    proxyTicketsApiGet(req, "/ticket-queues"),
    proxyTicketsApiGet(req, "/ticket-teams"),
    proxyTicketsApiGet(req, "/ticket-tags"),
    fetchTicketOperators(req),
  ]);

  if (!categoriesRes.ok) {
    const body = await categoriesRes.json().catch(() => ({}));
    const code = readOperatorTicketsBffErrorCode(body) ?? "TICKET_META_FAILED";
    return jsonTicketsBffError(code, categoriesRes.status);
  }

  const categoriesBody = (await categoriesRes.json()) as ItemsResponse<{
    readonly code: string;
    readonly labelKey: string;
    readonly sortOrder: number;
  }>;

  const queues =
    queuesRes.ok
      ? ((await queuesRes.json()) as ItemsResponse<{ readonly code: string; readonly name: string }>)
          .items
      : [];
  const teams =
    teamsRes.ok
      ? ((await teamsRes.json()) as ItemsResponse<{ readonly code: string; readonly name: string }>)
          .items
      : [];
  const tags =
    tagsRes.ok
      ? ((await tagsRes.json()) as ItemsResponse<{ readonly code: string; readonly label: string }>)
          .items
      : [];

  const payload: OperatorTicketsMetaBffPayload = {
    ok: true,
    meta: buildOperatorTicketsMetaView({
      categories: categoriesBody.items ?? [],
      queues,
      teams,
      tags,
      operators,
    }),
  };

  return NextResponse.json(payload, {
    status: 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}
