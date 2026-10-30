import { cookies, headers } from "next/headers";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { validateSessionToken } from "@app-tour/session-client";
import { resolveOperatorSessionPluginIdForHost } from "@/auth/resolve-operator-session-plugin.server";

function normalizeRole(role: string | undefined): OperatorSessionContext["role"] | null {
  if (role === "owner" || role === "admin" || role === "member" || role === "viewer") {
    return role;
  }
  return null;
}

export async function readOperatorSessionFromCookies(): Promise<OperatorSessionContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_TOKEN_COOKIE)?.value;
  const validation = await validateSessionToken(token);
  if (validation.status !== "valid") {
    return null;
  }

  const role = normalizeRole(validation.role);
  if (role === null) {
    return null;
  }

  const host = (await headers()).get("host") ?? "localhost:3000";
  const pluginId = await resolveOperatorSessionPluginIdForHost(validation.tenantId, host);
  if (pluginId === null) {
    return null;
  }

  return {
    userId: validation.userId,
    tenantId: validation.tenantId,
    role,
    workspaceType: pluginId,
    pluginId,
  };
}
