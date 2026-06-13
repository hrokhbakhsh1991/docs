import { cookies, headers } from "next/headers";

import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { groupInstallmentsByBoardColumn, parseSchedulesListResponse } from "@/finance/finance-installments-logic";
import {
  parseFinanceLedgerListResponse,
  parseFinanceSummary,
  type FinanceLedgerEvent,
  type FinanceSummary,
} from "@/finance/finance-reports-logic";
import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

async function fetchFinanceBackendJson(path: string): Promise<unknown | null> {
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

export type FinanceOverviewServerPrefetch = {
  readonly summary: FinanceSummary;
  readonly ledgerItems: readonly FinanceLedgerEvent[];
  readonly overdueInstallments: number;
};

/** Server prefetch for finance overview — avoids client-only loading stall. */
export async function fetchFinanceOverviewServer(): Promise<FinanceOverviewServerPrefetch | null> {
  const [summaryRaw, ledgerRaw, schedulesRaw] = await Promise.all([
    fetchFinanceBackendJson("/finance/reports/summary"),
    fetchFinanceBackendJson("/finance/reports/ledger-events?limit=5"),
    fetchFinanceBackendJson("/finance/schedules"),
  ]);

  if (summaryRaw === null || ledgerRaw === null) {
    return null;
  }

  const summary = parseFinanceSummary(summaryRaw);
  const ledgerItems = parseFinanceLedgerListResponse(ledgerRaw).items;
  let overdueInstallments = 0;
  if (schedulesRaw !== null) {
    const schedules = parseSchedulesListResponse(schedulesRaw);
    overdueInstallments = groupInstallmentsByBoardColumn(schedules.items).overdue.length;
  }

  return { summary, ledgerItems, overdueInstallments };
}
