export type MetricLabels = Readonly<Record<string, string>>;

/** Tenant business counters — increment without `tenant_id` throws (MET-API-01 / DEC-049). */
export const TENANT_SCOPED_METRIC_NAMES = new Set<string>([
  "tour_creation_count",
  "projection_inconsistency_total",
]);

function labelKey(labels: MetricLabels | undefined): string {
  if (!labels || Object.keys(labels).length === 0) {
    return "";
  }
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
}

function seriesKey(name: string, labels: MetricLabels | undefined): string {
  const lk = labelKey(labels);
  return lk.length > 0 ? `${name}{${lk}}` : name;
}

export const METRIC_TENANT_LABEL_REQUIRED = "METRIC_TENANT_LABEL_REQUIRED";

function assertTenantScopedMetricLabels(name: string, labels: MetricLabels | undefined): void {
  if (!TENANT_SCOPED_METRIC_NAMES.has(name)) {
    return;
  }
  const tenantId = labels?.tenant_id?.trim();
  if (tenantId === undefined || tenantId.length === 0) {
    throw new Error(`${METRIC_TENANT_LABEL_REQUIRED}:${name}`);
  }
}

/**
 * In-process labeled counter registry (Phase 5 scaffold).
 * Phase 7 may bridge this to Prometheus text or OTLP — keep label cardinality bounded.
 */
export class MetricsRegistry {
  private readonly counters = new Map<string, number>();

  increment(name: string, labels?: MetricLabels, amount = 1): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    assertTenantScopedMetricLabels(name, labels);
    const key = seriesKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + amount);
  }

  getMetric(name: string, labels?: MetricLabels): number {
    return this.counters.get(seriesKey(name, labels)) ?? 0;
  }

  /** Test-only — clears all series. */
  reset(): void {
    this.counters.clear();
  }

  /** Snapshot of all counter series (name+labels key → value). */
  snapshot(): ReadonlyMap<string, number> {
    return new Map(this.counters);
  }
}

export const metricsRegistry = new MetricsRegistry();

export function resetMetricsRegistryForTests(): void {
  metricsRegistry.reset();
}

/** tour_creation_count{tenant_id} — successful canonical tour persist. */
export function recordTourCreated(tenantId: string): void {
  metricsRegistry.increment("tour_creation_count", { tenant_id: tenantId });
}
