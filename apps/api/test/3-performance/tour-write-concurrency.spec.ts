/**
 * Phase 3 step 13 — concurrent POST /tours cap (DEC-064 / SCAL-DEBT-09).
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  getActiveTourWritesForTests,
  resetTourWriteConcurrencyBudgetForTests,
  TourWriteConcurrencyExceededError,
  withTourWriteConcurrencyBudget,
} from "../../src/http/tour-write-concurrency-budget";
import { metricsRegistry, resetMetricsRegistryForTests } from "../../src/observability/metrics";
import { integrationTenantId } from "../test-helpers";

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("tour write concurrency cap (DEC-064)", () => {
  const prevMax = process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES;

  afterEach(() => {
    resetTourWriteConcurrencyBudgetForTests();
    resetMetricsRegistryForTests();
    if (prevMax === undefined) {
      delete process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES;
    } else {
      process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES = prevMax;
    }
  });

  it("rejects when tenant exceeds concurrent create cap", async () => {
    process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES = "2";
    const tenantId = integrationTenantId();

    let releaseFirst!: () => void;
    let releaseSecond!: () => void;
    const holdFirst = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const holdSecond = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });

    const first = withTourWriteConcurrencyBudget(tenantId, () => holdFirst);
    const second = withTourWriteConcurrencyBudget(tenantId, () => holdSecond);
    await flush();
    assert.equal(getActiveTourWritesForTests(tenantId), 2);

    await assert.rejects(
      () => withTourWriteConcurrencyBudget(tenantId, async () => "blocked"),
      TourWriteConcurrencyExceededError
    );
    assert.equal(
      metricsRegistry.getMetric("tour_write_concurrency_shed_total", { tenant_id: tenantId }),
      1
    );

    releaseFirst();
    releaseSecond();
    await Promise.all([first, second]);
    assert.equal(getActiveTourWritesForTests(tenantId), 0);
  });

  it("isolates concurrent create counters per tenant", async () => {
    process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES = "1";
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();

    let releaseA!: () => void;
    const holdA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });

    const runningA = withTourWriteConcurrencyBudget(tenantA, () => holdA);
    await flush();

    await assert.rejects(
      () => withTourWriteConcurrencyBudget(tenantA, async () => "blocked"),
      TourWriteConcurrencyExceededError
    );

    const runningB = await withTourWriteConcurrencyBudget(tenantB, async () => "ok");
    assert.equal(runningB, "ok");

    releaseA();
    await runningA;
  });
});
