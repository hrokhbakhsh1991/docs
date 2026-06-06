import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ServerResponse } from "node:http";

import { readDbPoolSaturatedTotal } from "../db/pool-saturation-monitor";
import { DbPoolSaturatedError } from "../db/pool-saturation";
import { TenantDbBudgetExceededError } from "../db/tenant-connection-budget";
import { resetMetricsRegistryForTests } from "../observability/metrics";
import { runWithTraceContext } from "../observability/trace-request-context";
import { handleHttpError } from "./error-interceptor";

function mockResponse(): ServerResponse & {
  statusCode?: number;
  body?: unknown;
  headers: Record<string, string>;
} {
  const res = {
    writableEnded: false,
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
    end(payload?: unknown) {
      if (typeof payload === "string") {
        this.body = JSON.parse(payload);
      }
    },
  };
  return res as ServerResponse & {
    statusCode?: number;
    body?: unknown;
    headers: Record<string, string>;
  };
}

describe("error-interceptor pool saturation Retry-After (DEC-113)", () => {
  it("sets Retry-After on DbPoolSaturatedError", () => {
    resetMetricsRegistryForTests();
    const res = mockResponse();
    runWithTraceContext("pool-sat-trace", () => {
      handleHttpError(res, new DbPoolSaturatedError("pool timeout", 3));
    });
    assert.equal(res.statusCode, 503);
    assert.equal(res.headers["retry-after"], "3");
    assert.equal((res.body as { code?: string })?.code, "DB_POOL_SATURATED");
    assert.equal(readDbPoolSaturatedTotal(), 1);
  });

  it("sets Retry-After on TenantDbBudgetExceededError", () => {
    resetMetricsRegistryForTests();
    const res = mockResponse();
    runWithTraceContext("tenant-budget-trace", () => {
      handleHttpError(res, new TenantDbBudgetExceededError(4));
    });
    assert.equal(res.statusCode, 503);
    assert.ok(res.headers["retry-after"]);
    assert.equal(readDbPoolSaturatedTotal(), 0);
  });
});
