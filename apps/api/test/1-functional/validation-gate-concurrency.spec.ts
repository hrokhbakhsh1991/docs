/**
 * HT-03 — per-tenant validation gates do not clobber each other under concurrency.
 * DM-CT-05 — scheduler binds tenant ALS before validation body runs.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  clearPreTransactionValidationGate,
  consumePreTransactionValidationGate,
  isPreTransactionValidationGateOpenForTests,
  runPreTransactionValidation,
} from "../../src/canonical/pre-transaction-validation";
import { resetValidationSchedulerForTests } from "../../src/canonical/validation-scheduler";
import { integrationTenantId } from "../test-helpers";

const VALID_BODY = {
  data: { basics: { title: "gate-concurrency" }, details: { summary: "ok" } },
} as const;

afterEach(() => {
  clearPreTransactionValidationGate();
  resetValidationSchedulerForTests();
});

describe("validation gate concurrency (HT-03)", () => {
  it("scheduler binds tenant ALS without outer runWithTenantContext", async () => {
    const tenantId = integrationTenantId();

    await runPreTransactionValidation({
      tenantId,
      workspaceType: "starter",
      body: VALID_BODY,
    });

    assert.equal(isPreTransactionValidationGateOpenForTests(tenantId), true);
  });

  it("parallel tenants keep independent gates until consumed", async () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();

    await Promise.all([
      runPreTransactionValidation({
        tenantId: tenantA,
        workspaceType: "starter",
        body: VALID_BODY,
      }),
      runPreTransactionValidation({
        tenantId: tenantB,
        workspaceType: "starter",
        body: VALID_BODY,
      }),
    ]);

    assert.equal(isPreTransactionValidationGateOpenForTests(tenantA), true);
    assert.equal(isPreTransactionValidationGateOpenForTests(tenantB), true);

    consumePreTransactionValidationGate(tenantA);
    assert.equal(isPreTransactionValidationGateOpenForTests(tenantA), false);
    assert.equal(isPreTransactionValidationGateOpenForTests(tenantB), true);

    consumePreTransactionValidationGate(tenantB);
    assert.equal(isPreTransactionValidationGateOpenForTests(tenantB), false);
  });

  it("scheduler ALS matches input tenantId under forced queue contention", async () => {
    const previousMax = process.env.P5_VALIDATION_MAX_CONCURRENT;
    process.env.P5_VALIDATION_MAX_CONCURRENT = "1";

    const tenants = Array.from({ length: 4 }, () => integrationTenantId());

    try {
      await Promise.all(
        tenants.map((tenantId) =>
          runPreTransactionValidation({
            tenantId,
            workspaceType: "starter",
            body: {
              data: {
                basics: { title: `als-${tenantId.slice(0, 8)}` },
                details: { summary: "ok" },
              },
            },
          })
        )
      );

      for (const tenantId of tenants) {
        assert.equal(isPreTransactionValidationGateOpenForTests(tenantId), true);
      }
    } finally {
      if (previousMax === undefined) {
        delete process.env.P5_VALIDATION_MAX_CONCURRENT;
      } else {
        process.env.P5_VALIDATION_MAX_CONCURRENT = previousMax;
      }
    }
  });
});
