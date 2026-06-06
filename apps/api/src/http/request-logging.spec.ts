import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

import { logger } from "../observability/logger";
import {
  __getHttpRequestLogQueueSizeForTests,
  __resetHttpRequestLogQueueForTests,
  enqueueHttpRequestLog,
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
});
