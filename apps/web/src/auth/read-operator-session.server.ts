import { cookies, headers } from "next/headers";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { validateSessionToken } from "@app-tour/session-client";
import { resolveBootstrapPluginIdForTenant } from "@/tenant/tenant-kernel.shared";

function normalizeRole(role: string | undefined): OperatorSessionContext["role"] | null {
  if (role === "owner" || role === "admin" || role === "member") {
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
  const pluginId = resolveBootstrapPluginIdForTenant(validation.tenantId, host);

  return {
    userId: validation.userId,
    tenantId: validation.tenantId,
    role,
    workspaceType: pluginId,
    pluginId,
  };
}
