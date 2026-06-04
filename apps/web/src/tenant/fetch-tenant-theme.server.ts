import type { TenantAuthContext, TenantThemeConfig } from "@app-tour/workspace-sdk";

function apiBaseUrl(): string {
  return (
    process.env.API_INTERNAL_URL ??
    process.env.API_BASE_URL ??
    `http://127.0.0.1:${process.env.API_PORT ?? "3001"}`
  );
}

/**
 * Phase 4.4 — load tenant branding from API (server-only, header auth).
 */
export async function fetchTenantThemeForContext(
  context: TenantAuthContext,
  host: string,
): Promise<TenantThemeConfig | null> {
  const url = `${apiBaseUrl().replace(/\/$/, "")}/api/v2/tenant-config`;

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
