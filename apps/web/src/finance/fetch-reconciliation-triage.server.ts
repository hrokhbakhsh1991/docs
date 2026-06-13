import { cookies, headers } from "next/headers";

import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { groupInstallmentsByBoardColumn, parseSchedulesListResponse } from "@/finance/finance-installments-logic";
import { parseFinanceLedgerListResponse, parseFinanceSummary } from "@/finance/finance-reports-logic";
import {
  buildReconciliationFindings,
  type ReconciliationFinding,
} from "@/finance/reconciliation-triage-logic";
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

/** Server prefetch for reconciliation triage — avoids client-only loading stall. */
export async function fetchReconciliationTriageServer(): Promise<readonly ReconciliationFinding[] | null> {
  const [summaryRaw, schedulesRaw, ledgerRaw] = await Promise.all([
    fetchFinanceBackendJson("/finance/reports/summary"),
    fetchFinanceBackendJson("/finance/schedules"),
    fetchFinanceBackendJson("/finance/reports/ledger-events?limit=100"),
  ]);

  if (summaryRaw === null) {
    return null;
  }

  const summary = parseFinanceSummary(summaryRaw);
  let overdueInstallments = 0;
  if (schedulesRaw !== null) {
    const schedules = parseSchedulesListResponse(schedulesRaw);
    overdueInstallments = groupInstallmentsByBoardColumn(schedules.items).overdue.length;
  }
  let ledgerEventCount = 0;
  if (ledgerRaw !== null) {
    ledgerEventCount = parseFinanceLedgerListResponse(ledgerRaw).items.length;
  }

  return buildReconciliationFindings(summary, overdueInstallments, ledgerEventCount);
}
