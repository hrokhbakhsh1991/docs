import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, afterEach } from "node:test";

import { logger } from "../observability/logger";
import { runWithTenantContext } from "../tenant/tenant-request-context";
import {
  __getHttpRequestLogQueueSizeForTests,
  __resetHttpRequestLogQueueForTests,
  enqueueHttpRequestLog,
  withRequestLogging,
} from "./request-logging";

function waitForImmediate(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe("request logging queue (DEC-062)", () => {
  afterEach(() => {
    __resetHttpRequestLogQueueForTests();
  });

  it("enqueues on finish path and drains asynchronously", async () => {
    enqueueHttpRequestLog({
      method: "GET",
      path: "/health",
      statusCode: 200,
      durationMs: 1,
    });

    assert.equal(__getHttpRequestLogQueueSizeForTests(), 1);
    await waitForImmediate();
    assert.equal(__getHttpRequestLogQueueSizeForTests(), 0);
  });

  it("remains fail-open under queue pressure", async () => {
    const originalInfo = logger.info.bind(logger);
    const originalWarn = logger.warn.bind(logger);
    (logger.info as unknown as (...args: unknown[]) => void) = () => {};
    (logger.warn as unknown as (...args: unknown[]) => void) = () => {};
    try {
      for (let i = 0; i < 3_000; i += 1) {
        enqueueHttpRequestLog({
          method: "POST",
          path: "/tours",
          statusCode: 201,
          durationMs: i % 10,
        });
      }

      await waitForImmediate();
      assert.equal(__getHttpRequestLogQueueSizeForTests(), 0);
    } finally {
      (logger.info as unknown as (...args: unknown[]) => void) = originalInfo;
      (logger.warn as unknown as (...args: unknown[]) => void) = originalWarn;
    }
  });

  it("uses neutral workspaceType when tenant context lacks workspace binding", async () => {
    const originalInfo = logger.info.bind(logger);
    let captured: Record<string, unknown> | undefined;
    (logger.info as unknown as (obj: Record<string, unknown>) => void) = (obj) => {
      captured = obj;
    };
    try {
      const req = { method: "GET", url: "/tours" } as never;
      const res = new EventEmitter() as EventEmitter & { statusCode: number };
      res.statusCode = 200;
      const listener = withRequestLogging(async (_req, response) => {
        response.emit("finish");
      });

      await runWithTenantContext("00000000-0000-4000-8000-000000000001", async () => {
        await listener(req, res as never);
      });
      await waitForImmediate();

      assert.equal(captured?.tenantId, "00000000-0000-4000-8000-000000000001");
      assert.equal(captured?.workspaceType, "unknown");
      assert.equal(captured?.tenantTier, "pool");
    } finally {
      (logger.info as unknown as (...args: unknown[]) => void) = originalInfo;
    }
  });

  it("does not invent starter workspace metadata", () => {
    const source = readFileSync(join(import.meta.dirname, "request-logging.ts"), "utf8");
    assert.doesNotMatch(source, /getActiveWorkspaceType\(\)\s*\?\?\s*["']starter["']/);
    assert.match(source, /getActiveWorkspaceType\(\)\s*\?\?\s*["']unknown["']/);
  });
});
