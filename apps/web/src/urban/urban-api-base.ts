/**
 * Server-only API bridge — re-exports guest-surface-host resolver (PSC-001 Phase 1a).
 * @see docs/standards/platform-surface-cohesion.mdoc
 */
export {
  assertGuestBffProductionConfig,
  resolveTourOpsApiBaseUrl,
} from "@app-tour/guest-surface-host";

/** @deprecated Use `resolveTourOpsApiBaseUrl` — kept for incremental migration. */
export { resolveTourOpsApiBaseUrl as resolveUrbanApiBaseUrl } from "@app-tour/guest-surface-host";

export function buildUrbanPublicTenantHeaders(tenantId: string): Record<string, string> {
  return { "x-tenant-id": tenantId };
}
