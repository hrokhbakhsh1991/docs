import { buildIdentityBffHeadersForTenant as buildSharedIdentityBffHeadersForTenant } from "@app-tour/session-client";

export function buildIdentityBffHeadersForTenant(
  host: string,
  tenantId: string
): Record<string, string> {
  return buildSharedIdentityBffHeadersForTenant(host, tenantId, {
    workspaceId:
      process.env.TOUR_OPS_DEV_WORKSPACE_ID?.trim() ??
      process.env.NEXT_PUBLIC_DEV_WORKSPACE_ID?.trim(),
  });
}
