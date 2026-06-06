import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  readHealthProbeLastDurationMs,
  readHealthProbeP99Ms,
  readHealthProbeSlowTotal,
  recordHealthProbeDuration,
  resetHealthProbeLatencyMonitorForTests,
  resolveHealthProbeLatencyBudgetMs,
} from "./health-probe-latency";

describe("health-probe-latency (NN-01 / A1)", () => {
  afterEach(() => {
    resetHealthProbeLatencyMonitorForTests();
    delete process.env.HEALTH_PROBE_LATENCY_BUDGET_MS;
  });

  it("defaults probe budget to 500ms", () => {
    assert.equal(resolveHealthProbeLatencyBudgetMs(), 500);
  });

  it("computes p99 over recorded samples", () => {
    for (let i = 1; i <= 100; i += 1) {
      recordHealthProbeDuration(i);
    }
    assert.equal(readHealthProbeP99Ms(), 99);
    assert.equal(readHealthProbeLastDurationMs(), 100);
  });

  it("increments slow total when duration exceeds budget", () => {
    process.env.HEALTH_PROBE_LATENCY_BUDGET_MS = "10";
    recordHealthProbeDuration(5);
    recordHealthProbeDuration(25);
    assert.equal(readHealthProbeSlowTotal(), 1);
  });
});
