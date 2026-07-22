import { cookies, headers } from "next/headers";

import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

/** Server prefetch for wizard destination catalog — avoids client-only loading stall. */
export async function fetchWizardLocationsServer(): Promise<unknown | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_TOKEN_COOKIE)?.value?.trim();
  if (token === undefined || token.length === 0) {
    return null;
  }

  const host = (await headers()).get("host") ?? "localhost:3000";
  const apiBase = resolveTourOpsApiBaseUrl();

  try {
    const backendRes = await fetch(`${apiBase}/settings/resources/locations`, {
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
