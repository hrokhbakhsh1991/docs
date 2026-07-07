import { cookies, headers } from "next/headers";

import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { readOperatorSessionFromCookies } from "@/auth/read-operator-session.server";
import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";
import {
  guardSettingsModulesAgainstBackend,
  logSettingsModuleUiDesync,
} from "@/features/settings/settings-module-consistency-guard";

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
    const payload = (await backendRes.json()) as SettingsModulesListResponse;
    const session = await readOperatorSessionFromCookies();
    const pluginId = session?.pluginId ?? "starter";
    const guarded = guardSettingsModulesAgainstBackend(payload.items, pluginId);
    if (guarded.desyncDetected) {
      logSettingsModuleUiDesync({
        pluginId,
        missingFromBackend: guarded.missingFromBackend,
      });
    }
    return { items: guarded.modules };
  } catch {
    return null;
  }
}
