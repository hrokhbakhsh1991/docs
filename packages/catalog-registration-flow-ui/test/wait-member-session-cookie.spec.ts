import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { waitForMemberSessionCookie } from "../src/wait-member-session-cookie.ts";

describe("waitForMemberSessionCookie", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns true when profile probe succeeds", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch;
    assert.equal(await waitForMemberSessionCookie(2), true);
  });

  it("returns false after hung attempts instead of hanging forever", async () => {
    globalThis.fetch = (async (_input, init) => {
      const signal = init?.signal;
      return await new Promise<Response>((_resolve, reject) => {
        if (signal === undefined) {
          // no timeout — would hang; force fail for test visibility
          reject(new Error("missing abort signal"));
          return;
        }
        signal.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    }) as typeof fetch;

    const started = Date.now();
    const ready = await waitForMemberSessionCookie(2);
    const elapsed = Date.now() - started;
    assert.equal(ready, false);
    // 2 attempts × 2500ms timeout + small backoff — must finish well under a minute
    assert.ok(elapsed < 20_000, `expected bounded wait, got ${elapsed}ms`);
  });
});
