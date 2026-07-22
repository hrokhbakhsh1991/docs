import { cookies, headers } from "next/headers";

import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

import type {
  BookingsListResponse,
  BookingsSummaryResponse,
} from "./bookings-command-center-types";

async function fetchBookingsBackendJson(path: string): Promise<unknown | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_TOKEN_COOKIE)?.value?.trim();
  if (token === undefined || token.length === 0) {
    return null;
  }

  const host = (await headers()).get("host") ?? "localhost:3000";
  const apiBase = resolveTourOpsApiBaseUrl();

  try {
    const backendRes = await fetch(`${apiBase}${path}`, {
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

export type BookingsServerPrefetch = {
  readonly list: BookingsListResponse;
  readonly summary: BookingsSummaryResponse | null;
};

/** Server prefetch for bookings command center — avoids client-only loading stall. */
export async function fetchBookingsServerPrefetch(
  listQueryString: string,
  includeSummary: boolean
): Promise<BookingsServerPrefetch | null> {
  const [listRaw, summaryRaw] = await Promise.all([
    fetchBookingsBackendJson(`/bookings?${listQueryString}`),
    includeSummary ? fetchBookingsBackendJson("/bookings/summary") : Promise.resolve(null),
  ]);

  if (listRaw === null) {
    return null;
  }

  return {
    list: listRaw as BookingsListResponse,
    summary: summaryRaw === null ? null : (summaryRaw as BookingsSummaryResponse),
  };
}
