import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

import { recordDbPoolSaturatedResponse } from "../db/pool-saturation-monitor";
import {
  readDbPoolConnectionLimitFromEnv,
  readOutboxRelayPoolHeadroom,
} from "../outbox/outbox-relay-pool-contention";
import { recordAdminPoolRead } from "../tenant/admin-pool-read-monitor";
import { formatPrometheusMetrics } from "./prometheus-format";
import { metricsRegistry, resetMetricsRegistryForTests } from "./metrics";

describe("prometheus-format (DEC-108)", () => {
  afterEach(() => {
    resetMetricsRegistryForTests();
  });

  it("exports counters and runtime gauges as text", () => {
    const poolLimit = readDbPoolConnectionLimitFromEnv();
    const relayHeadroom = readOutboxRelayPoolHeadroom();

    metricsRegistry.increment("tour_creation_count", { tenant_id: "tenant-a" });
    recordDbPoolSaturatedResponse();
    recordAdminPoolRead(42);
    const body = formatPrometheusMetrics();
    assert.match(body, /tour_creation_count\{tenant_id="tenant-a"\} 1/);
    assert.match(body, /http_requests_in_flight 0/);
    assert.match(body, /tour_write_in_flight_total 0/);
    assert.match(body, /tour_write_in_flight_max_per_tenant 0/);
    assert.match(body, /tour_write_tenants_active 0/);
    assert.match(body, /outbox_pending_total 0/);
    assert.match(body, /outbox_failed_total 0/);
    assert.match(body, /outbox_relay_in_flight_total 0/);
    assert.match(body, /outbox_relay_in_flight_max_per_tenant 0/);
    assert.match(body, /outbox_relay_tenants_active 0/);
    assert.match(body, new RegExp(`db_pool_connection_limit_config ${poolLimit}`));
    assert.match(body, /outbox_relay_publish_concurrency_config 16/);
    assert.match(body, new RegExp(`outbox_relay_pool_headroom ${relayHeadroom}`));
    assert.match(body, /validation_queue_depth_total 0/);
    assert.match(body, /validation_queue_depth_max_per_tenant 0/);
    assert.match(body, /validation_queue_tenants_pending 0/);
    assert.match(body, /validation_queue_in_flight_total 0/);
    assert.match(body, /db_circuit_open 0/);
    assert.match(body, /domain_event_handler_slow_total 0/);
    assert.match(body, /health_probe_p99_ms 0/);
    assert.match(body, /health_probe_slow_total 0/);
    assert.match(body, /log_shutdown_flush_timed_out_total 0/);
    assert.match(body, /log_sink_drop_total 0/);
    assert.match(body, /http_request_body_rejected_total 0/);
    assert.match(body, /http_response_body_rejected_total 0/);
    assert.match(body, /db_pool_saturated_total 1/);
    assert.match(body, /admin_pool_read_p99_ms 42/);
    assert.match(body, /admin_pool_read_slow_total 0/);
  });
});
