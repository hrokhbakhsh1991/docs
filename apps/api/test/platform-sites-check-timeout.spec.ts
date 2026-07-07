import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  SITE_HEALTH_CHECK_TIMEOUT_MS,
  headCheckSiteHealth,
} from "../src/platform/check-tenant-sites-health.ts";

describe("platform sites check timeout", () => {
  it("timeout ok false", async () => {
    assert.equal(SITE_HEALTH_CHECK_TIMEOUT_MS, 5000);

    const source = readFileSync(
      new URL("../src/platform/check-tenant-sites-health.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /AbortSignal\.timeout/);

    const slowFetch: typeof fetch = (_url, init) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve(new Response(null, { status: 200 }));
        }, 200);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });

    const result = await headCheckSiteHealth("https://slow.example.test", {
      fetchImpl: slowFetch,
      timeoutMs: 50,
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, null);
  });
});
