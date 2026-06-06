import { metricsRegistry } from "../observability/metrics";

/** HTTP 503 DB_POOL_SATURATED counter — A4 storm visibility (DEC-012). */
export function recordDbPoolSaturatedResponse(): void {
  metricsRegistry.increment("db_pool_saturated_total");
}

export function readDbPoolSaturatedTotal(): number {
  return metricsRegistry.getMetric("db_pool_saturated_total");
}
