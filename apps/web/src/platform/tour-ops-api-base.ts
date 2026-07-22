/**
 * Server-only Tour Ops / guest BFF API bridge (Wave H.a).
 * Re-exports guest-surface-host resolver (PSC-001) — product-blind; not under a product-named src folder.
 * @see docs/dev/wave-h-platform-tour-ops-api-base.mdoc
 * @see docs/standards/platform-surface-cohesion.mdoc
 */
export {
  assertGuestBffProductionConfig,
  resolveTourOpsApiBaseUrl,
} from "@app-tour/guest-surface-host";

/** Public catalog / guest egress tenant header. */
export function buildPublicTenantHeaders(tenantId: string): Record<string, string> {
  return { "x-tenant-id": tenantId };
}
