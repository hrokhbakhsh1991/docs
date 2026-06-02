import { Injectable } from "@nestjs/common";
import { tryGetActiveTraceLogFields } from "./active-trace-log-fields";
import { isAuthSessionLoginRoute } from "../auth/auth-route-policy";

/**
 * In-process security-ish counters (Prometheus text or JSON for adapters).
 * Canonical names used by Prometheus `security_events_total{event=...}` and OTLP mapping.
 *
 * TODO: feed the same dimensions into a **metrics dashboard** (RED/USE, SLO burn) via OTLP or
 * Prometheus remote-write — keep label cardinality bounded; correlate spikes with `trace_id` in logs.
 */
export type SecurityMetricEvent =
  | "TENANT_HOST_UNKNOWN"
  | "TENANT_HOST_TOKEN_MISMATCH"
  | "AUTH_LOGIN_FAILURE"
  | "AUTH_MEMBERSHIP_DENIED";

const TENANT_RESOLUTION_CODES = new Set([
  "TENANT_HOST_UNKNOWN",
  "TENANT_HOST_INVALID",
  "TENANT_HOST_RESERVED"
]);

const TENANT_MISMATCH_CODES = new Set(["TENANT_HOST_TOKEN_MISMATCH", "TENANT_HOST_MISMATCH"]);

/**
 * In-process counters suitable for Prometheus text scraping (`GET .../metrics/prometheus`)
 * or an OTLP bridge that pushes aggregated deltas from `/internal/ops/metrics/security` JSON.
 */
@Injectable()
export class ObservabilityMetricsService {
  private readonly tenantResolutionByCode = new Map<string, number>();
  private authLoginFailuresTotal = 0;
  private tenantMismatchTotal = 0;
  private readonly securityEventsByEvent = new Map<string, number>();
  private tenantResolverCacheHits = 0;
  private tenantResolverCacheMisses = 0;

  /** Bump aggregates when an HTTP exception envelope exits the pipeline (production-safe mapping). */
  recordHttpException(params: {
    errorCode: string;
    path: string;
    method: string;
    statusCode: number;
  }): void {
    const { errorCode, path, method } = params;
    const traceFields = tryGetActiveTraceLogFields();
    const authPublicSessionLogin = isAuthSessionLoginRoute(path, method);

    if (TENANT_RESOLUTION_CODES.has(errorCode)) {
      this.bumpMap(this.tenantResolutionByCode, errorCode);
    }

    if (TENANT_MISMATCH_CODES.has(errorCode)) {
      this.tenantMismatchTotal += 1;
    }

    if (errorCode === "AUTH_UNAUTHENTICATED" && authPublicSessionLogin) {
      this.authLoginFailuresTotal += 1;
      this.bumpSecurityEvent("AUTH_LOGIN_FAILURE");
    }

    if (errorCode === "TENANT_SCOPE_FORBIDDEN" && path.startsWith("/api/v2/auth/")) {
      this.bumpSecurityEvent("AUTH_MEMBERSHIP_DENIED");
    }

    if (errorCode === "TENANT_HOST_UNKNOWN") {
      this.bumpSecurityEvent("TENANT_HOST_UNKNOWN");
    }

    if (errorCode === "TENANT_HOST_TOKEN_MISMATCH") {
      this.bumpSecurityEvent("TENANT_HOST_TOKEN_MISMATCH");
    }

    if (
      traceFields &&
      (TENANT_RESOLUTION_CODES.has(errorCode) ||
        TENANT_MISMATCH_CODES.has(errorCode) ||
        errorCode === "AUTH_UNAUTHENTICATED" ||
        errorCode === "TENANT_SCOPE_FORBIDDEN")
    ) {
      this.recordMetricAlertCorrelation(errorCode, traceFields.trace_id);
    }
  }

  private readonly metricAlertTraces: Array<{ error_code: string; trace_id: string }> =
    [];

  /**
   * Bounded store so alerts on Prometheus counters can pivot into traces without exploding cardinality on labels.
   */
  private recordMetricAlertCorrelation(errorCode: string, traceId: string): void {
    this.metricAlertTraces.push({ error_code: errorCode, trace_id: traceId });
    while (this.metricAlertTraces.length > 32) {
      this.metricAlertTraces.shift();
    }
  }

  /** Recent traces tied to security-ish metric bumps (same request as counter increment). */
  getMetricAlertTraceHints(): ReadonlyArray<{ error_code: string; trace_id: string }> {
    return this.metricAlertTraces;
  }

  private bumpMap(map: Map<string, number>, key: string): void {
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  bumpSecurityEvent(event: SecurityMetricEvent): void {
    this.bumpMap(this.securityEventsByEvent, event);
  }

  recordTenantResolverCacheHit(): void {
    this.tenantResolverCacheHits += 1;
  }

  recordTenantResolverCacheMiss(): void {
    this.tenantResolverCacheMisses += 1;
  }

  /** Structured snapshot for JSON exporters / OTEL adapters. */
  getSecurityMetricsSnapshot(): {
    tenant_resolution_failures_total: Record<string, number>;
    auth_login_failures_total: number;
    tenant_mismatch_total: number;
    security_events_total: Record<string, number>;
    tenant_resolver_cache_hits: number;
    tenant_resolver_cache_misses: number;
    metric_alert_trace_hints: ReadonlyArray<{ error_code: string; trace_id: string }>;
  } {
    return {
      tenant_resolution_failures_total: Object.fromEntries(this.tenantResolutionByCode),
      auth_login_failures_total: this.authLoginFailuresTotal,
      tenant_mismatch_total: this.tenantMismatchTotal,
      security_events_total: Object.fromEntries(this.securityEventsByEvent),
      tenant_resolver_cache_hits: this.tenantResolverCacheHits,
      tenant_resolver_cache_misses: this.tenantResolverCacheMisses,
      metric_alert_trace_hints: [...this.metricAlertTraces]
    };
  }

  /** Prometheus exposition format (text/plain). */
  getPrometheusText(): string {
    const lines: string[] = [
      "# Observability: correlate counter spikes with traces via structured logs (trace_id, span_id) or metric_alert_trace_hints JSON.",
      "# OTLP traces export: OTEL_EXPORTER_OTLP_ENDPOINT or OTEL_EXPORTER_OTLP_TRACES_ENDPOINT (Jaeger / Tempo / Datadog OTLP / Collector)."
    ];

    if (this.tenantResolutionByCode.size > 0) {
      lines.push(
        "# HELP tenant_resolution_failures_total Failures resolving tenant from Host (unknown / invalid / reserved label).",
        "# TYPE tenant_resolution_failures_total counter"
      );
      for (const [code, n] of this.tenantResolutionByCode) {
        lines.push(`tenant_resolution_failures_total{code="${escapePrometheusLabel(code)}"} ${n}`);
      }
    }

    lines.push(
      "# HELP auth_login_failures_total Failed web OTP or telegram session login (AUTH_UNAUTHENTICATED on session endpoints).",
      "# TYPE auth_login_failures_total counter",
      `auth_login_failures_total ${this.authLoginFailuresTotal}`
    );

    lines.push(
      "# HELP tenant_mismatch_total JWT tenant vs Host mismatch or workspace/host mismatch.",
      "# TYPE tenant_mismatch_total counter",
      `tenant_mismatch_total ${this.tenantMismatchTotal}`
    );
    lines.push(
      "# HELP tenant_resolver_cache_hits Total hostname->tenant resolver cache hits.",
      "# TYPE tenant_resolver_cache_hits counter",
      `tenant_resolver_cache_hits ${this.tenantResolverCacheHits}`
    );
    lines.push(
      "# HELP tenant_resolver_cache_misses Total hostname->tenant resolver cache misses.",
      "# TYPE tenant_resolver_cache_misses counter",
      `tenant_resolver_cache_misses ${this.tenantResolverCacheMisses}`
    );

    if (this.securityEventsByEvent.size > 0) {
      lines.push(
        "# HELP security_events_total Selected security signals for alerting dashboards.",
        "# TYPE security_events_total counter"
      );
      for (const [event, n] of this.securityEventsByEvent) {
        lines.push(`security_events_total{event="${escapePrometheusLabel(event)}"} ${n}`);
      }
    }

    return `${lines.join("\n")}\n`;
  }
}

function escapePrometheusLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}
