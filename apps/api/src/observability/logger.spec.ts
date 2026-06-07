import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { logger, logHttpRequest } from "./logger";

describe("logHttpRequest MAP §10.2 fields", () => {
  const originalInfo = logger.info.bind(logger);
  let captured: Record<string, unknown> | undefined;

  afterEach(() => {
    (logger.info as unknown as (...args: unknown[]) => void) = originalInfo;
    captured = undefined;
  });

  it("emits requestId, tenantId, workspaceType, tenantTier, durationMs", () => {
    (logger.info as unknown as (obj: Record<string, unknown>) => void) = (obj) => {
      captured = obj;
    };

    logHttpRequest({
      method: "POST",
      path: "/tours",
      statusCode: 201,
      durationMs: 42,
      requestId: "trace-abc",
      tenantId: "tenant-1",
      workspaceType: "urban",
      tenantTier: "pool",
    });

    assert.equal(captured!.requestId, "trace-abc");
    assert.equal(captured!.correlation_id, "trace-abc");
    assert.equal(captured!.tenantId, "tenant-1");
    assert.equal(captured!.workspaceType, "urban");
    assert.equal(captured!.tenantTier, "pool");
    assert.equal(captured!.durationMs, 42);
  });

  it("omits tenant fields for health-style requests", () => {
    (logger.info as unknown as (obj: Record<string, unknown>) => void) = (obj) => {
      captured = obj;
    };

    logHttpRequest({
      method: "GET",
      path: "/health",
      statusCode: 200,
      durationMs: 1,
    });

    assert.equal(captured!.tenantId, undefined);
    assert.equal(captured!.workspaceType, undefined);
    assert.equal(captured!.tenantTier, undefined);
    assert.equal(captured!.durationMs, 1);
  });
});
