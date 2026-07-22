import { cookies, headers } from "next/headers";

import {
  parseDashboardBookingsSummary,
  parseDashboardToursList,
  type DashboardServerPrefetch,
} from "@/admin/dashboard/dashboard-widgets-logic";
import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { parseDashboardFinanceSummary } from "@/finance/finance-dashboard-widget-logic";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

async function fetchBackendJson(path: string): Promise<unknown | null> {
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

/** Server prefetch for dashboard widgets — avoids client-only loading stall. */
export async function fetchDashboardServerPrefetch(): Promise<DashboardServerPrefetch> {
  const [toursRaw, summaryRaw, financeRaw] = await Promise.all([
    fetchBackendJson("/tours?view=operator&limit=3"),
    fetchBackendJson("/bookings/summary"),
    fetchBackendJson("/finance/reports/summary"),
  ]);

  return {
    tours: toursRaw === null ? null : parseDashboardToursList(toursRaw),
    bookingsSummary: summaryRaw === null ? null : parseDashboardBookingsSummary(summaryRaw),
    financeSummary: financeRaw === null ? null : parseDashboardFinanceSummary(financeRaw),
  };
}
