import { metricsRegistry } from "../observability/metrics";

const DEFAULT_MAX_IN_FLIGHT_PER_TENANT = 4;

const activeByTenant = new Map<string, number>();

export function resolveOutboxRelayMaxInFlightPerTenant(): number {
  const raw = process.env.OUTBOX_RELAY_MAX_IN_FLIGHT_PER_TENANT?.trim();
  if (!raw) {
    return DEFAULT_MAX_IN_FLIGHT_PER_TENANT;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_MAX_IN_FLIGHT_PER_TENANT;
}

function recordOutboxRelayTenantDeferred(tenantId: string): void {
  metricsRegistry.increment("outbox_relay_tenant_deferred_total", { tenant_id: tenantId });
}

/** Test-only — active in-flight relay publishes for a tenant. */
export function getActiveOutboxRelayPublishesForTests(tenantId: string): number {
  return activeByTenant.get(tenantId.trim()) ?? 0;
}

/** In-flight relay publish snapshot for metrics (DEC-108 / B4). */
export function getOutboxRelayInFlightSnapshot(): {
  readonly total: number;
  readonly maxPerTenant: number;
  readonly tenantsActive: number;
} {
  let total = 0;
  let maxPerTenant = 0;
  for (const active of activeByTenant.values()) {
    total += active;
    if (active > maxPerTenant) {
      maxPerTenant = active;
    }
  }
  return { total, maxPerTenant, tenantsActive: activeByTenant.size };
}

/** Test-only — reset counters between specs. */
export function resetOutboxRelayTenantBudgetForTests(): void {
  activeByTenant.clear();
}

/**
 * Non-blocking acquire for per-tenant relay publish slots (DEC-066 / SCAL-DEBT-10).
 */
export function tryAcquireOutboxRelayTenantSlot(tenantId: string): boolean {
  const normalized = tenantId.trim();
  const maxInFlight = resolveOutboxRelayMaxInFlightPerTenant();
  const active = activeByTenant.get(normalized) ?? 0;
  if (active >= maxInFlight) {
    recordOutboxRelayTenantDeferred(normalized);
    return false;
  }
  activeByTenant.set(normalized, active + 1);
  return true;
}

export function releaseOutboxRelayTenantSlot(tenantId: string): void {
  const normalized = tenantId.trim();
  const active = activeByTenant.get(normalized) ?? 0;
  if (active <= 1) {
    activeByTenant.delete(normalized);
    return;
  }
  activeByTenant.set(normalized, active - 1);
}
