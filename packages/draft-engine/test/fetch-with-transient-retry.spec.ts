import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { fetchWithTransientRetry } from "../src/fetch-with-transient-retry";

describe("fetch-with-transient-retry.spec.ts", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("DE-RETRY-01 returns first response when not transient", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response("ok", { status: 200 });
    }) as typeof globalThis.fetch;

    const response = await fetchWithTransientRetry("http://example.test/draft");
    assert.equal(response.status, 200);
    assert.equal(calls, 1);
  });

  it("DE-RETRY-02 retries once on 503 then succeeds", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("busy", { status: 503 });
      }
      return new Response("ok", { status: 200 });
    }) as typeof globalThis.fetch;

    const response = await fetchWithTransientRetry(
      "http://example.test/draft",
      undefined,
      { retryDelayMs: 0 }
    );
    assert.equal(response.status, 200);
    assert.equal(calls, 2);
  });
});
