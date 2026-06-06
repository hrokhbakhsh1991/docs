import { readDomainEventHandlerSlowTotal } from "@app-tour/platform-events";

import {
  readHealthProbeLastDurationMs,
  readHealthProbeP99Ms,
  readHealthProbeSlowTotal,
} from "../health/health-probe-latency";
import {
  readAdminPoolReadLastDurationMs,
  readAdminPoolReadP99Ms,
  readAdminPoolReadSlowTotal,
} from "../tenant/admin-pool-read-monitor";
import {
  readValidationQueueDepthMaxPerTenant,
  readValidationQueueDepthTotal,
  readValidationQueueInFlightTotal,
  readValidationQueueTenantsPending,
} from "../canonical/validation-queue-monitor";
import { isDbCircuitOpen } from "../db/db-circuit-breaker";
import { readHttpRequestsInFlight } from "../http/http-inflight-metrics";
import {
  readHttpRequestBodyRejectedTotal,
  readHttpResponseBodyRejectedTotal,
} from "../http/http-json-pressure-monitor";
import {
  readTourWriteInFlightMaxPerTenant,
  readTourWriteInFlightTotal,
  readTourWriteTenantsActive,
} from "../http/tour-write-concurrency-monitor";
import { isRedisRateLimiterCircuitOpen } from "../middleware/redis-rate-limiter-resilience";
import {
  readOutboxFailedTotalGauge,
  readOutboxPendingTotalGauge,
} from "../outbox/outbox-pending-metrics";
import { readOutboxRelayOldestPendingAgeSeconds } from "../outbox/outbox-relay-lag-monitor";
import {
  readOutboxRelayInFlightMaxPerTenant,
  readOutboxRelayInFlightTotal,
  readOutboxRelayTenantsActive,
} from "../outbox/outbox-relay-monitor";
import {
  readDbPoolConnectionLimitFromEnv,
  readOutboxRelayPoolHeadroom,
  readOutboxRelayPublishConcurrencyConfig,
} from "../outbox/outbox-relay-pool-contention";
import {
  readOutboxRelayDeferredLastTick,
  readOutboxRelayFailedLastTick,
  readOutboxRelayPublishedLastTick,
  readOutboxRelayPublishedTotal,
  readOutboxRelayTickSkippedTotal,
} from "../outbox/outbox-relay-tick-monitor";
import { metricsRegistry } from "./metrics";

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function formatSample(name: string, value: number, labels?: Record<string, string>): string {
  if (labels && Object.keys(labels).length > 0) {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${escapeLabelValue(v)}"`)
      .join(",");
    return `${name}{${labelStr}} ${value}`;
  }
  return `${name} ${value}`;
}

function parseSeriesKey(key: string): { name: string; labels: Record<string, string> } {
  const brace = key.indexOf("{");
  if (brace < 0) {
    return { name: key, labels: {} };
  }
  const name = key.slice(0, brace);
  const inner = key.slice(brace + 1, -1);
  const labels: Record<string, string> = {};
  if (inner.length > 0) {
    for (const part of inner.split(",")) {
      const eq = part.indexOf("=");
      if (eq > 0) {
        labels[part.slice(0, eq)] = part.slice(eq + 1);
      }
    }
  }
  return { name, labels };
}

/** Prometheus text 0.0.4 exposition from in-process registry + runtime gauges (DEC-108). */
export function formatPrometheusMetrics(): string {
  const lines: string[] = [];

  for (const [key, value] of metricsRegistry.snapshotCounters()) {
    const { name, labels } = parseSeriesKey(key);
    lines.push(formatSample(name, value, labels));
  }

  for (const [key, value] of metricsRegistry.snapshotGauges()) {
    const { name, labels } = parseSeriesKey(key);
    lines.push(formatSample(name, value, labels));
  }

  lines.push(formatSample("http_requests_in_flight", readHttpRequestsInFlight()));
  lines.push(formatSample("tour_write_in_flight_total", readTourWriteInFlightTotal()));
  lines.push(
    formatSample("tour_write_in_flight_max_per_tenant", readTourWriteInFlightMaxPerTenant())
  );
  lines.push(formatSample("tour_write_tenants_active", readTourWriteTenantsActive()));
  lines.push(formatSample("outbox_pending_total", readOutboxPendingTotalGauge()));
  lines.push(
    formatSample(
      "outbox_relay_oldest_pending_age_seconds",
      readOutboxRelayOldestPendingAgeSeconds()
    )
  );
  lines.push(formatSample("outbox_failed_total", readOutboxFailedTotalGauge()));
  lines.push(formatSample("outbox_relay_in_flight_total", readOutboxRelayInFlightTotal()));
  lines.push(
    formatSample("outbox_relay_in_flight_max_per_tenant", readOutboxRelayInFlightMaxPerTenant())
  );
  lines.push(formatSample("outbox_relay_tenants_active", readOutboxRelayTenantsActive()));
  lines.push(formatSample("db_pool_connection_limit_config", readDbPoolConnectionLimitFromEnv()));
  lines.push(
    formatSample(
      "outbox_relay_publish_concurrency_config",
      readOutboxRelayPublishConcurrencyConfig()
    )
  );
  lines.push(formatSample("outbox_relay_pool_headroom", readOutboxRelayPoolHeadroom()));
  lines.push(formatSample("outbox_relay_tick_skipped_total", readOutboxRelayTickSkippedTotal()));
  lines.push(formatSample("outbox_relay_published_total", readOutboxRelayPublishedTotal()));
  lines.push(formatSample("outbox_relay_published_last_tick", readOutboxRelayPublishedLastTick()));
  lines.push(formatSample("outbox_relay_failed_last_tick", readOutboxRelayFailedLastTick()));
  lines.push(formatSample("outbox_relay_deferred_last_tick", readOutboxRelayDeferredLastTick()));
  lines.push(formatSample("validation_queue_depth_total", readValidationQueueDepthTotal()));
  lines.push(
    formatSample("validation_queue_depth_max_per_tenant", readValidationQueueDepthMaxPerTenant())
  );
  lines.push(formatSample("validation_queue_tenants_pending", readValidationQueueTenantsPending()));
  lines.push(formatSample("validation_queue_in_flight_total", readValidationQueueInFlightTotal()));
  lines.push(formatSample("db_circuit_open", isDbCircuitOpen() ? 1 : 0));
  lines.push(
    formatSample("redis_rate_limiter_circuit_open", isRedisRateLimiterCircuitOpen() ? 1 : 0)
  );
  lines.push(formatSample("domain_event_handler_slow_total", readDomainEventHandlerSlowTotal()));
  lines.push(
    formatSample("log_sink_drain_total", metricsRegistry.getMetric("log_sink_drain_total"))
  );
  lines.push(formatSample("log_sink_drop_total", metricsRegistry.getMetric("log_sink_drop_total")));
  lines.push(
    formatSample("log_sink_error_total", metricsRegistry.getMetric("log_sink_error_total"))
  );
  lines.push(
    formatSample("log_shutdown_flush_total", metricsRegistry.getMetric("log_shutdown_flush_total"))
  );
  lines.push(
    formatSample(
      "log_shutdown_flush_timed_out_total",
      metricsRegistry.getMetric("log_shutdown_flush_timed_out_total")
    )
  );
  lines.push(formatSample("health_probe_duration_ms_last", readHealthProbeLastDurationMs()));
  lines.push(formatSample("health_probe_p99_ms", readHealthProbeP99Ms()));
  lines.push(formatSample("health_probe_slow_total", readHealthProbeSlowTotal()));
  lines.push(formatSample("admin_pool_read_duration_ms_last", readAdminPoolReadLastDurationMs()));
  lines.push(formatSample("admin_pool_read_p99_ms", readAdminPoolReadP99Ms()));
  lines.push(formatSample("admin_pool_read_slow_total", readAdminPoolReadSlowTotal()));
  lines.push(formatSample("http_request_body_rejected_total", readHttpRequestBodyRejectedTotal()));
  lines.push(
    formatSample("http_response_body_rejected_total", readHttpResponseBodyRejectedTotal())
  );

  return `${lines.join("\n")}\n`;
}
