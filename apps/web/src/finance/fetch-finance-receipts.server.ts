import { cookies, headers } from "next/headers";

import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import {
  parseFinancePendingReceiptsResponse,
  type FinancePendingReceiptsResponse,
} from "@/finance/finance-receipts-logic";
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

/** Server prefetch for finance receipts tab — avoids client-only loading stall. */
export async function fetchFinanceReceiptsServer(): Promise<FinancePendingReceiptsResponse | null> {
  const raw = await fetchFinanceBackendJson("/finance/receipts/pending?limit=50");
  if (raw === null) {
    return null;
  }
  return parseFinancePendingReceiptsResponse(raw);
}
