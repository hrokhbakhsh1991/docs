import { cookies, headers } from "next/headers";

import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { buildOperatorTicketListView } from "@/features/tickets/operator-tickets-bff.server";
import { buildOperatorTicketsApiQuery, parseOperatorTicketsCommandCenterQuery } from "@/features/tickets/operator-tickets-command-center-logic";
import type { OperatorTicketListView } from "@/features/tickets/operator-tickets-types";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";
import type { PaginatedOperatorTicketListHttp } from "@app-tour/ticketing-http-contracts";

export type OperatorTicketsServerPrefetch = {
  readonly list: OperatorTicketListView;
};

async function fetchTicketsBackendJson(path: string): Promise<unknown | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_TOKEN_COOKIE)?.value?.trim();
  if (token === undefined || token.length === 0) {
    return null;
  }

  const host = (await headers()).get("host") ?? "localhost:3000";
  const apiBase = resolveTourOpsApiBaseUrl();

  try {
    const backendRes = await operatorApiFetch(`${apiBase}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        host: host.split(":")[0] ?? "localhost",
      },
      cache: "no-store",
    });
    if (!backendRes.ok) {
      return null;
    }
    return (await backendRes.json()) as unknown;
  } catch {
    return null;
  }
}

export async function fetchOperatorTicketsServerPrefetch(
  listQueryString: string,
  locale: string,
): Promise<OperatorTicketsServerPrefetch | null> {
  const listRaw = await fetchTicketsBackendJson(`/tickets?${listQueryString}`);
  if (listRaw === null) {
    return null;
  }
  return {
    list: buildOperatorTicketListView(listRaw as PaginatedOperatorTicketListHttp, locale),
  };
}

export function buildPrefetchApiQueryFromSearchParams(
  params: Record<string, string | string[] | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const entry of value) search.append(key, entry);
    } else {
      search.set(key, value);
    }
  }
  const query = parseOperatorTicketsCommandCenterQuery(search);
  return buildOperatorTicketsApiQuery(query);
}
