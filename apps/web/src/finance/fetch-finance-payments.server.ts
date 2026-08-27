import { cookies, headers } from "next/headers";

import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { operatorApiFetch } from "@/auth/operator-api-fetch";
import {
  parseFinancePaymentsListResponse,
  type FinancePaymentsListResponse,
} from "@/finance/finance-payments-logic";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

async function fetchFinanceBackendJson(path: string): Promise<unknown | null> {
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

/** Server prefetch for finance payments tab — avoids client-only loading stall. */
export async function fetchFinancePaymentsServer(): Promise<FinancePaymentsListResponse | null> {
  const raw = await fetchFinanceBackendJson("/finance/payments?limit=50");
  if (raw === null) {
    return null;
  }
  return parseFinancePaymentsListResponse(raw);
}
