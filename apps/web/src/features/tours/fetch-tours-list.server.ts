import { cookies, headers } from "next/headers";

import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import {
  DEFAULT_TOUR_LIST_QUERY,
  serializeTourListQuery,
  type TourListQueryModel,
} from "@/features/tours/query-model";
import type { OperatorTourListResponse } from "@/features/tours/operator-tours-types";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

/** Server prefetch for tours list — avoids client-only loading stall. */
export async function fetchToursListServer(
  query: TourListQueryModel = DEFAULT_TOUR_LIST_QUERY
): Promise<OperatorTourListResponse | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_TOKEN_COOKIE)?.value?.trim();
  if (token === undefined || token.length === 0) {
    return null;
  }

  const host = (await headers()).get("host") ?? "localhost:3000";
  const apiBase = resolveTourOpsApiBaseUrl();

  try {
    const backendRes = await fetch(`${apiBase}/tours?${serializeTourListQuery(query)}`, {
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
    return (await backendRes.json()) as OperatorTourListResponse;
  } catch {
    return null;
  }
}
