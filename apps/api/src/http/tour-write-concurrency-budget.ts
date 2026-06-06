import { metricsRegistry } from "../observability/metrics";

export const TOUR_WRITE_CONCURRENCY_EXCEEDED = "TOUR_WRITE_CONCURRENCY_EXCEEDED";

const DEFAULT_MAX_CONCURRENT_TOUR_WRITES = 8;

const activeByTenant = new Map<string, number>();

export class TourWriteConcurrencyExceededError extends Error {
  readonly code = TOUR_WRITE_CONCURRENCY_EXCEEDED;

  constructor(public readonly maxWrites: number) {
    super(TOUR_WRITE_CONCURRENCY_EXCEEDED);
    this.name = "TourWriteConcurrencyExceededError";
  }
}

export function isTourWriteConcurrencyExceededError(
  error: unknown
): error is TourWriteConcurrencyExceededError {
  return error instanceof TourWriteConcurrencyExceededError;
}

export function resolveTenantMaxConcurrentTourWrites(): number {
  const raw = process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES?.trim();
  if (!raw) {
    return DEFAULT_MAX_CONCURRENT_TOUR_WRITES;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_MAX_CONCURRENT_TOUR_WRITES;
}

function recordTourWriteConcurrencyShed(tenantId: string): void {
  metricsRegistry.increment("tour_write_concurrency_shed_total", { tenant_id: tenantId });
}

function acquireTourWriteSlot(tenantId: string): void {
  const normalized = tenantId.trim();
  const maxWrites = resolveTenantMaxConcurrentTourWrites();
  const active = activeByTenant.get(normalized) ?? 0;
  if (active >= maxWrites) {
    recordTourWriteConcurrencyShed(normalized);
    throw new TourWriteConcurrencyExceededError(maxWrites);
  }
  activeByTenant.set(normalized, active + 1);
}

function releaseTourWriteSlot(tenantId: string): void {
  const normalized = tenantId.trim();
  const active = activeByTenant.get(normalized) ?? 0;
  if (active <= 1) {
    activeByTenant.delete(normalized);
    return;
  }
  activeByTenant.set(normalized, active - 1);
}

/** Test-only — active in-flight POST /tours count for a tenant. */
export function getActiveTourWritesForTests(tenantId: string): number {
  return activeByTenant.get(tenantId.trim()) ?? 0;
}

/** In-flight POST /tours snapshot for metrics (DEC-108 / B3). */
export function getTourWriteInFlightSnapshot(): {
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
export function resetTourWriteConcurrencyBudgetForTests(): void {
  activeByTenant.clear();
}

/**
 * Per-tenant concurrent create cap (DEC-064 / SCAL-DEBT-09).
 * Non-blocking — throws before route business logic when tenant is at cap.
 */
export async function withTourWriteConcurrencyBudget<T>(
  tenantId: string,
  run: () => Promise<T>
): Promise<T> {
  acquireTourWriteSlot(tenantId);
  try {
    return await run();
  } finally {
    releaseTourWriteSlot(tenantId);
  }
}
