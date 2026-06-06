import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

import { metricsRegistry, resetMetricsRegistryForTests } from "../observability/metrics";
import { readDbPoolSaturatedTotal, recordDbPoolSaturatedResponse } from "./pool-saturation-monitor";

describe("pool-saturation-monitor (A4)", () => {
  afterEach(() => {
    resetMetricsRegistryForTests();
  });

  it("increments db_pool_saturated_total on each 503 mapping", () => {
    assert.equal(readDbPoolSaturatedTotal(), 0);
    recordDbPoolSaturatedResponse();
    recordDbPoolSaturatedResponse();
    assert.equal(readDbPoolSaturatedTotal(), 2);
    assert.equal(metricsRegistry.getMetric("db_pool_saturated_total"), 2);
  });
});
