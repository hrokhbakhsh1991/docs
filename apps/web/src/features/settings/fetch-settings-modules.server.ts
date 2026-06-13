import { cookies, headers } from "next/headers";

import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

import type { SettingsModulesListResponse } from "./settings-module-types";

/** Server prefetch for settings hub — avoids client-only loading stall on slow JS hydration. */
export async function fetchSettingsModulesServer(): Promise<SettingsModulesListResponse | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_TOKEN_COOKIE)?.value?.trim();
  if (token === undefined || token.length === 0) {
    return null;
  }

  const host = (await headers()).get("host") ?? "localhost:3000";
  const apiBase = resolveTourOpsApiBaseUrl();

  try {
    const backendRes = await fetch(`${apiBase}/settings/modules`, {
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
    return (await backendRes.json()) as SettingsModulesListResponse;
  } catch {
    return null;
  }
}
