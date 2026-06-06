import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

import { metricsRegistry, resetMetricsRegistryForTests } from "../observability/metrics";
import {
  readTourWriteInFlightMaxPerTenant,
  readTourWriteInFlightTotal,
  readTourWriteTenantsActive,
  resolveTourWriteInFlightAlertMaxPerTenant,
  resolveTourWriteInFlightAlertTotal,
} from "./tour-write-concurrency-monitor";
import {
  resetTourWriteConcurrencyBudgetForTests,
  withTourWriteConcurrencyBudget,
} from "./tour-write-concurrency-budget";

describe("tour-write-concurrency-monitor (B3 / NN-05)", () => {
  afterEach(() => {
    resetTourWriteConcurrencyBudgetForTests();
    resetMetricsRegistryForTests();
    delete process.env.TOUR_WRITE_IN_FLIGHT_ALERT_TOTAL;
    delete process.env.TOUR_WRITE_IN_FLIGHT_ALERT_MAX_PER_TENANT;
    delete process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES;
  });

  it("defaults alert thresholds", () => {
    assert.equal(resolveTourWriteInFlightAlertTotal(), 20);
    assert.equal(resolveTourWriteInFlightAlertMaxPerTenant(), 6);
  });

  it("reports in-flight gauges from concurrency budget snapshot", async () => {
    process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES = "2";
    let releaseFirst!: () => void;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    let releaseSecond!: () => void;
    const secondBlocked = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });

    const first = withTourWriteConcurrencyBudget("tenant-a", async () => {
      await firstBlocked;
      return "first";
    });
    const second = withTourWriteConcurrencyBudget("tenant-a", async () => {
      await secondBlocked;
      return "second";
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.equal(readTourWriteInFlightTotal(), 2);
    assert.equal(readTourWriteInFlightMaxPerTenant(), 2);
    assert.equal(readTourWriteTenantsActive(), 1);

    releaseFirst();
    releaseSecond();
    await Promise.all([first, second]);
  });

  it("increments shed counter at cap (DEC-064)", async () => {
    process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES = "1";
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });

    const held = withTourWriteConcurrencyBudget("tenant-b", async () => {
      await blocked;
      return "held";
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    await assert.rejects(
      () => withTourWriteConcurrencyBudget("tenant-b", async () => "overflow"),
      (error: unknown) =>
        error instanceof Error && error.message.includes("TOUR_WRITE_CONCURRENCY_EXCEEDED")
    );
    assert.equal(
      metricsRegistry.getMetric("tour_write_concurrency_shed_total", { tenant_id: "tenant-b" }),
      1
    );

    release!();
    await held;
  });
});
