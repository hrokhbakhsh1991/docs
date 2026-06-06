import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

import {
  readValidationQueueDepthMaxPerTenant,
  readValidationQueueDepthTotal,
  readValidationQueueInFlightTotal,
  readValidationQueueTenantsPending,
  resolveValidationQueueDepthAlertMaxPerTenant,
  resolveValidationQueueDepthAlertTotal,
} from "./validation-queue-monitor";
import { resetValidationSchedulerForTests, runScheduledValidation } from "./validation-scheduler";

describe("validation-queue-monitor (B2 / NN-04)", () => {
  afterEach(() => {
    resetValidationSchedulerForTests();
    delete process.env.VALIDATION_QUEUE_DEPTH_ALERT_TOTAL;
    delete process.env.VALIDATION_QUEUE_DEPTH_ALERT_MAX_PER_TENANT;
  });

  it("defaults alert thresholds", () => {
    assert.equal(resolveValidationQueueDepthAlertTotal(), 200);
    assert.equal(resolveValidationQueueDepthAlertMaxPerTenant(), 50);
  });

  it("reports depth gauges from scheduler snapshot", async () => {
    process.env.P5_VALIDATION_MAX_CONCURRENT = "1";
    let releaseFirst!: () => void;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = runScheduledValidation("tenant-a", async () => {
      await firstBlocked;
      return "first";
    });
    const second = runScheduledValidation("tenant-a", async () => "second");
    const third = runScheduledValidation("tenant-a", async () => "third");

    await new Promise((resolve) => setTimeout(resolve, 30));

    assert.equal(readValidationQueueInFlightTotal(), 1);
    assert.equal(readValidationQueueDepthTotal(), 2);
    assert.equal(readValidationQueueDepthMaxPerTenant(), 2);
    assert.equal(readValidationQueueTenantsPending(), 1);

    releaseFirst();
    await Promise.all([first, second, third]);
  });
});
