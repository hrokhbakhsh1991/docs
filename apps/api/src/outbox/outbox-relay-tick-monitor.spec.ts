import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { metricsRegistry, resetMetricsRegistryForTests } from "../observability/metrics";
import {
  readOutboxRelayDeferredLastTick,
  readOutboxRelayFailedLastTick,
  readOutboxRelayPublishedLastTick,
  readOutboxRelayPublishedTotal,
  readOutboxRelayTickSkippedTotal,
  recordOutboxRelayTickResult,
  recordOutboxRelayTickSkipped,
  resetOutboxRelayTickMonitorForTests,
} from "./outbox-relay-tick-monitor";

describe("outbox-relay-tick-monitor (C3/C4)", () => {
  afterEach(() => {
    resetOutboxRelayTickMonitorForTests();
    resetMetricsRegistryForTests();
  });

  it("increments tick skipped counter (C3)", () => {
    recordOutboxRelayTickSkipped();
    recordOutboxRelayTickSkipped();
    assert.equal(readOutboxRelayTickSkippedTotal(), 2);
  });

  it("records publish throughput on tick complete (C4)", () => {
    recordOutboxRelayTickResult({ published: 7, failed: 1, deferred: 2 });
    assert.equal(readOutboxRelayPublishedTotal(), 7);
    assert.equal(metricsRegistry.getMetric("outbox_relay_tick_total"), 1);
    assert.equal(readOutboxRelayPublishedLastTick(), 7);
    assert.equal(readOutboxRelayFailedLastTick(), 1);
    assert.equal(readOutboxRelayDeferredLastTick(), 2);
    assert.equal(metricsRegistry.getGauge("outbox_relay_published_last_tick"), 7);
  });
});
