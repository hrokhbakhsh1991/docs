import type { TenantAuthContext, TenantThemeConfig } from "@app-tour/workspace-sdk";

import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

/**
 * Phase 4.4 — load tenant branding from API (server-only, header auth).
 */
export async function fetchTenantThemeForContext(
  context: TenantAuthContext,
  host: string,
): Promise<TenantThemeConfig | null> {
  const url = `${resolveTourOpsApiBaseUrl()}/api/v2/tenant-config`;

  const headers: Record<string, string> = {
    host,
    "x-authenticated-tenant-id": context.tenantId,
    "x-tenant-id": context.tenantId,
    "x-user-id": context.userId,
    "x-workspace-id": context.workspaceId ?? "default",
    "x-actor-role": context.role,
    "x-membership-status": context.status,
  };

  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { theme?: TenantThemeConfig };
    return body.theme ?? null;
  } catch {
    return null;
  }
}
