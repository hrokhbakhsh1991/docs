import { metricsRegistry } from "../observability/metrics";

const DEFAULT_READ_BUDGET_MS = 500;
const SAMPLE_CAPACITY = 128;

export type TenantRegistryCacheKind = "by_id" | "by_subdomain" | "theme";

const samples: number[] = [];
let sampleWriteIndex = 0;
let sampleCount = 0;
let slowReadTotal = 0;
let lastReadDurationMs = 0;

export function resolveAdminPoolReadBudgetMs(): number {
  const raw = process.env.ADMIN_POOL_READ_BUDGET_MS?.trim();
  if (raw === undefined || raw.length === 0) {
    return DEFAULT_READ_BUDGET_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_READ_BUDGET_MS;
  }
  return Math.floor(parsed);
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

export function recordTenantRegistryCacheHit(kind: TenantRegistryCacheKind): void {
  metricsRegistry.increment("tenant_registry_cache_hit_total", { kind });
}

export function recordTenantRegistryCacheMiss(kind: TenantRegistryCacheKind): void {
  metricsRegistry.increment("tenant_registry_cache_miss_total", { kind });
}

export function recordAdminPoolRead(durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return;
  }

  lastReadDurationMs = durationMs;
  samples[sampleWriteIndex] = durationMs;
  sampleWriteIndex = (sampleWriteIndex + 1) % SAMPLE_CAPACITY;
  if (sampleCount < SAMPLE_CAPACITY) {
    sampleCount += 1;
  }

  if (durationMs > resolveAdminPoolReadBudgetMs()) {
    slowReadTotal += 1;
    metricsRegistry.increment("admin_pool_read_slow_total");
  }
}

export function readAdminPoolReadLastDurationMs(): number {
  return lastReadDurationMs;
}

export function readAdminPoolReadP99Ms(): number {
  if (sampleCount === 0) {
    return 0;
  }
  const active =
    sampleCount < SAMPLE_CAPACITY
      ? samples.slice(0, sampleCount)
      : [...samples.slice(sampleWriteIndex), ...samples.slice(0, sampleWriteIndex)];
  return percentile(active, 99);
}

export function readAdminPoolReadSlowTotal(): number {
  return slowReadTotal;
}

/** Test-only — reset admin pool read samples between specs. */
export function resetAdminPoolReadMonitorForTests(): void {
  samples.length = 0;
  sampleWriteIndex = 0;
  sampleCount = 0;
  slowReadTotal = 0;
  lastReadDurationMs = 0;
}
