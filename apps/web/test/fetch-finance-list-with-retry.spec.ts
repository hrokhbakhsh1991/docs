import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fetchFinanceListWithRetry } from "../src/finance/fetch-finance-list-with-retry.ts";

describe("fetchFinanceListWithRetry", () => {
  it("returns first successful response", async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }) as typeof fetch;
    try {
      const controller = new AbortController();
      const res = await fetchFinanceListWithRetry("/api/finance/receipts/pending", controller.signal);
      assert.equal(res.status, 200);
      assert.equal(calls, 1);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("retries once after 503 then succeeds", async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ error: "busy" }), { status: 503 });
      }
      return new Response(JSON.stringify({ items: [1] }), { status: 200 });
    }) as typeof fetch;
    try {
      const controller = new AbortController();
      const res = await fetchFinanceListWithRetry("/api/finance/x", controller.signal);
      assert.equal(res.status, 200);
      assert.equal(calls, 2);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("does not retry non-transient status", async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: "nope" }), { status: 401 });
    }) as typeof fetch;
    try {
      const controller = new AbortController();
      const res = await fetchFinanceListWithRetry("/api/finance/x", controller.signal);
      assert.equal(res.status, 401);
      assert.equal(calls, 1);
    } finally {
      globalThis.fetch = original;
    }
  });
});
