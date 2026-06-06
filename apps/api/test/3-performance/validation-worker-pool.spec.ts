/**
 * Phase 3 step 5 — validation worker pool + time budget (DEC-056 / SCAL-DEBT-02).
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { ServerResponse } from "node:http";

import {
  ValidationTimeBudgetExceededError,
  VALIDATION_TIME_BUDGET_EXCEEDED,
} from "../../src/canonical/validation-time-budget";
import { isSchemaVersionMismatchError } from "../../src/canonical/schema-version-mismatch";
import {
  resetValidationWorkerPoolForTests,
  runValidationOffThread,
} from "../../src/canonical/validation-worker-pool";
import { handleHttpError } from "../../src/middleware/error-interceptor";
import { runWithTraceContext } from "../../src/observability/trace-request-context";
import { runWithTenantContext } from "../../src/tenant/tenant-request-context";
import { integrationTenantId } from "../test-helpers";

function validationInput(tenantId: string) {
  return {
    body: {
      data: {
        basics: { title: `worker-pool-${tenantId}` },
        details: { summary: "ok" },
      },
    },
    tenantId,
    workspaceType: "starter" as const,
  };
}

function mockResponse(): ServerResponse & { statusCode?: number; body?: unknown } {
  const res = {
    writableEnded: false,
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    setHeader() {},
    end(payload?: unknown) {
      if (typeof payload === "string") {
        this.body = JSON.parse(payload);
      }
    },
  };
  return res as ServerResponse & { statusCode?: number; body?: unknown };
}

describe("validation worker pool (DEC-056)", () => {
  const prevWorkersEnabled = process.env.P5_VALIDATION_WORKERS_ENABLED;
  const prevPoolSize = process.env.P5_VALIDATION_WORKER_POOL_SIZE;

  afterEach(async () => {
    await resetValidationWorkerPoolForTests();
    if (prevWorkersEnabled === undefined) {
      delete process.env.P5_VALIDATION_WORKERS_ENABLED;
    } else {
      process.env.P5_VALIDATION_WORKERS_ENABLED = prevWorkersEnabled;
    }
    if (prevPoolSize === undefined) {
      delete process.env.P5_VALIDATION_WORKER_POOL_SIZE;
    } else {
      process.env.P5_VALIDATION_WORKER_POOL_SIZE = prevPoolSize;
    }
  });

  it("falls back to sync validation when workers disabled", async () => {
    process.env.P5_VALIDATION_WORKERS_ENABLED = "false";
    const tenantId = integrationTenantId();
    const document = await runValidationOffThread(validationInput(tenantId));
    assert.equal(document.data?.basics?.title, `worker-pool-${tenantId}`);
  });

  it("validates off-thread when workers enabled", async () => {
    delete process.env.P5_VALIDATION_WORKERS_ENABLED;
    process.env.P5_VALIDATION_WORKER_POOL_SIZE = "1";
    const tenantId = integrationTenantId();
    const document = await runValidationOffThread(validationInput(tenantId));
    assert.equal(document.data?.basics?.title, `worker-pool-${tenantId}`);
  });

  it("rehydrates SchemaVersionMismatchError from worker thread (DEC-078)", async () => {
    delete process.env.P5_VALIDATION_WORKERS_ENABLED;
    process.env.P5_VALIDATION_WORKER_POOL_SIZE = "1";
    const tenantId = integrationTenantId();

    await assert.rejects(
      () =>
        runWithTenantContext(tenantId, () =>
          runValidationOffThread({
            body: {
              schemaVersion: 2,
              data: { basics: { title: "stale-rev" }, details: { summary: "" } },
            },
            tenantId,
            workspaceType: "starter",
          })
        ),
      (error: unknown) => {
        assert.equal(isSchemaVersionMismatchError(error), true);
        return true;
      }
    );
  });

  it("maps time budget exceeded to HTTP 408", () => {
    const res = mockResponse();
    runWithTraceContext("validation-budget-trace", () => {
      handleHttpError(res, new ValidationTimeBudgetExceededError(10_000));
    });
    assert.equal(res.statusCode, 408);
    assert.equal(
      (res.body as { error?: string; code?: string })?.code,
      VALIDATION_TIME_BUDGET_EXCEEDED
    );
  });
});
