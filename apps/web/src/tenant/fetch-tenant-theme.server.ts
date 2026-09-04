import type { TenantAuthContext, TenantThemeConfig } from "@app-tour/workspace-sdk";
import { cookies } from "next/headers";

import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

/**
 * Phase 4.4 — load tenant branding from API (server-only, header auth).
 */
export async function fetchTenantThemeForContext(
  context: TenantAuthContext,
  host: string,
): Promise<TenantThemeConfig | null> {
  const url = `${resolveTourOpsApiBaseUrl()}/api/v2/tenant-config`;
  const sessionToken = (await cookies()).get(SESSION_TOKEN_COOKIE)?.value?.trim();

  const headers: Record<string, string> = {
    host,
    "x-authenticated-tenant-id": context.tenantId,
    "x-tenant-id": context.tenantId,
    "x-user-id": context.userId,
    "x-workspace-id": context.workspaceId ?? "default",
    "x-actor-role": context.role,
    "x-membership-status": context.status,
  };
  if (sessionToken !== undefined && sessionToken.length > 0) {
    headers.authorization = `Bearer ${sessionToken}`;
  }

  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { theme?: TenantThemeConfig };
    return body.theme ?? null;
  } catch {
    return null;
  }
}
