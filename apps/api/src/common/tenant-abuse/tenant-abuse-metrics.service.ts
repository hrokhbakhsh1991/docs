import { Injectable } from "@nestjs/common";
import type { TenantRateLimitScope } from "./tenant-abuse.constants";

const MAX_TRACKED_TENANTS = 256;

/**
 * In-process metrics for tenant abuse protection (complements Redis limits).
 * Prometheus series intentionally omit per-tenant labels to avoid cardinality blowups;
 * use JSON snapshot for sampled per-tenant volume estimates.
 */
@Injectable()
export class TenantAbuseMetricsService {
  private readonly exceededByScope = new Map<string, number>();
  private requestVolumeTotal = 0;
  private readonly volumeByTenant = new Map<string, number>();
  private redisFailuresTotal = 0;
  private fallbackActivatedTotal = 0;

  recordRateLimitExceeded(scope: TenantRateLimitScope): void {
    this.exceededByScope.set(scope, (this.exceededByScope.get(scope) ?? 0) + 1);
  }

  /** Counts API-layer requests that passed bypass (for throughput dashboards). */
  recordTenantRequestObserved(tenantId: string | undefined): void {
    this.requestVolumeTotal += 1;
    if (!tenantId || tenantId === "") {
      return;
    }
    const tid = tenantId.trim().toLowerCase();
    if (!this.volumeByTenant.has(tid) && this.volumeByTenant.size >= MAX_TRACKED_TENANTS) {
      const first = this.volumeByTenant.keys().next().value as string | undefined;
      if (first !== undefined) {
        this.volumeByTenant.delete(first);
      }
    }
    this.volumeByTenant.set(tid, (this.volumeByTenant.get(tid) ?? 0) + 1);
  }

  recordRedisFailure(): void {
    this.redisFailuresTotal += 1;
  }

  recordFallbackActivated(): void {
    this.fallbackActivatedTotal += 1;
  }

  getPrometheusText(): string {
    const lines: string[] = [
      "# HELP tenant_rate_limit_exceeded_total Tenant-aware Redis rate limit denials by scope (no per-tenant label).",
      "# TYPE tenant_rate_limit_exceeded_total counter"
    ];
    for (const [scope, n] of [...this.exceededByScope.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    )) {
      lines.push(
        `tenant_rate_limit_exceeded_total{limit_scope="${escapePrometheusLabel(scope)}"} ${n}`
      );
    }
    lines.push(
      "# HELP tenant_request_volume_total Observed /api/v2 requests counted by tenant-rate-limit middleware (global).",
      "# TYPE tenant_request_volume_total counter",
      `tenant_request_volume_total ${this.requestVolumeTotal}`
    );
    lines.push(
      "# HELP rate_limit_redis_failures_total Redis failures while evaluating tenant rate limits.",
      "# TYPE rate_limit_redis_failures_total counter",
      `rate_limit_redis_failures_total ${this.redisFailuresTotal}`
    );
    lines.push(
      "# HELP rate_limit_fallback_activated_total In-memory fallback activations due to Redis failures.",
      "# TYPE rate_limit_fallback_activated_total counter",
      `rate_limit_fallback_activated_total ${this.fallbackActivatedTotal}`
    );

    return `${lines.join("\n")}\n`;
  }

  getSnapshot(): {
    tenant_rate_limit_exceeded_total: Record<string, number>;
    tenant_request_volume_total: number;
    tenant_request_volume_sample_top: Array<{ tenant_id: string; requests: number }>;
    rate_limit_redis_failures: number;
    rate_limit_fallback_activated: number;
  } {
    const sampleTop = [...this.volumeByTenant.entries()]
      .map(([tenant_id, requests]) => ({ tenant_id, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 50);

    return {
      tenant_rate_limit_exceeded_total: Object.fromEntries(this.exceededByScope),
      tenant_request_volume_total: this.requestVolumeTotal,
      tenant_request_volume_sample_top: sampleTop,
      rate_limit_redis_failures: this.redisFailuresTotal,
      rate_limit_fallback_activated: this.fallbackActivatedTotal
    };
  }
}

function escapePrometheusLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}
