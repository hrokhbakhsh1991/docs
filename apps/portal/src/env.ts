export {
  assertGuestBffProductionConfig,
  resolveTourOpsApiBaseUrl,
} from "@app-tour/guest-surface-host";

export function buildPublicTenantHeaders(tenantId: string): Record<string, string> {
  return { "x-tenant-id": tenantId };
}
