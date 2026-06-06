/**
 * Phase 3 step 3 — validation queue max depth + shed (DEC-054 / SCAL-DEBT-06).
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { ValidationQueueSaturatedError } from "../../src/canonical/validation-queue-saturated";
import {
  getValidationQueueDepthForTests,
  resetValidationSchedulerForTests,
  runScheduledValidation,
} from "../../src/canonical/validation-scheduler";
import { metricsRegistry, resetMetricsRegistryForTests } from "../../src/observability/metrics";
import { integrationTenantId } from "../test-helpers";

function flushScheduler(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("validation queue depth (DEC-054)", () => {
  const prevConcurrent = process.env.P5_VALIDATION_MAX_CONCURRENT;
  const prevDepth = process.env.P5_VALIDATION_MAX_QUEUE_DEPTH_PER_TENANT;
  const prevInFlight = process.env.P5_VALIDATION_MAX_IN_FLIGHT_PER_TENANT;

  afterEach(() => {
    resetValidationSchedulerForTests();
    resetMetricsRegistryForTests();
    if (prevConcurrent === undefined) {
      delete process.env.P5_VALIDATION_MAX_CONCURRENT;
    } else {
      process.env.P5_VALIDATION_MAX_CONCURRENT = prevConcurrent;
    }
    if (prevDepth === undefined) {
      delete process.env.P5_VALIDATION_MAX_QUEUE_DEPTH_PER_TENANT;
    } else {
      process.env.P5_VALIDATION_MAX_QUEUE_DEPTH_PER_TENANT = prevDepth;
    }
    if (prevInFlight === undefined) {
      delete process.env.P5_VALIDATION_MAX_IN_FLIGHT_PER_TENANT;
    } else {
      process.env.P5_VALIDATION_MAX_IN_FLIGHT_PER_TENANT = prevInFlight;
    }
  });

  it("rejects enqueue when pending depth reaches cap", async () => {
    process.env.P5_VALIDATION_MAX_CONCURRENT = "1";
    process.env.P5_VALIDATION_MAX_QUEUE_DEPTH_PER_TENANT = "2";

    const tenantId = integrationTenantId();
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = runScheduledValidation(tenantId, () => hold as unknown as void);
    await flushScheduler();

    const second = runScheduledValidation(tenantId, () => undefined);
    const third = runScheduledValidation(tenantId, () => undefined);
    assert.equal(getValidationQueueDepthForTests(tenantId), 2);

    await assert.rejects(
      runScheduledValidation(tenantId, () => undefined),
      (error: unknown) => {
        assert.ok(error instanceof ValidationQueueSaturatedError);
        assert.equal(error.maxDepth, 2);
        return true;
      }
    );

    assert.equal(
      metricsRegistry.getMetric("validation_queue_shed_total", { tenant_id: tenantId }),
      1
    );

    release();
    await Promise.all([first, second, third]);
  });

  it("does not count in-flight work toward pending depth cap", async () => {
    process.env.P5_VALIDATION_MAX_CONCURRENT = "1";
    process.env.P5_VALIDATION_MAX_QUEUE_DEPTH_PER_TENANT = "1";

    const tenantId = integrationTenantId();
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });

    const running = runScheduledValidation(tenantId, () => hold as unknown as void);
    await flushScheduler();
    assert.equal(getValidationQueueDepthForTests(tenantId), 0);

    const queued = runScheduledValidation(tenantId, () => undefined);
    assert.equal(getValidationQueueDepthForTests(tenantId), 1);

    await assert.rejects(
      runScheduledValidation(tenantId, () => undefined),
      ValidationQueueSaturatedError
    );

    release();
    await Promise.all([running, queued]);
  });

  it("isolates queue depth per tenant", async () => {
    process.env.P5_VALIDATION_MAX_CONCURRENT = "2";
    process.env.P5_VALIDATION_MAX_IN_FLIGHT_PER_TENANT = "1";
    process.env.P5_VALIDATION_MAX_QUEUE_DEPTH_PER_TENANT = "1";

    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();

    let releaseA!: () => void;
    const holdA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });

    const runningA = runScheduledValidation(tenantA, () => holdA as unknown as void);
    await flushScheduler();

    const queuedA = runScheduledValidation(tenantA, () => undefined);
    await flushScheduler();
    assert.equal(getValidationQueueDepthForTests(tenantA), 1);

    await assert.rejects(
      runScheduledValidation(tenantA, () => undefined),
      ValidationQueueSaturatedError
    );

    const runningB = await runScheduledValidation(tenantB, () => "ok");
    assert.equal(runningB, "ok");

    releaseA();
    await Promise.all([runningA, queuedA]);
  });
});
