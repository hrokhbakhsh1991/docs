import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  fetchWorkspaceIntegrationMeta,
  fetchWorkspaceIntegrations,
} from "../src/integrations/integrations-client";

describe("integrations-client timeout guards", () => {
  it("WEB-INT-TIMEOUT-01 workspace integrations list fetch uses a timeout signal", async () => {
    const originalFetch = globalThis.fetch;
    try {
      let capturedSignal: AbortSignal | null = null;
      globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedSignal = init?.signal instanceof AbortSignal ? init.signal : null;
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch;

      const payload = await fetchWorkspaceIntegrations("ws-1");
      assert.deepEqual(payload.items, []);
      assert.ok(capturedSignal, "expected integrations fetch to install AbortSignal.timeout");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("WEB-INT-TIMEOUT-02 integration meta fetch uses a timeout signal", async () => {
    const originalFetch = globalThis.fetch;
    try {
      let capturedSignal: AbortSignal | null = null;
      globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedSignal = init?.signal instanceof AbortSignal ? init.signal : null;
        return new Response(JSON.stringify({ workspaceType: "denali", providers: [], exposureCandidateFields: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as typeof fetch;

      const payload = await fetchWorkspaceIntegrationMeta("ws-1");
      assert.equal(payload.workspaceType, "denali");
      assert.ok(capturedSignal, "expected integrations meta fetch to install AbortSignal.timeout");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
