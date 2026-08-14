/**
 * Phase 11.3 / 11.9 — workspace draft BFF proxy auth (WEB-P11-3-04, WEB-P11-9-01)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  proxyWorkspaceDraftApiRequest,
  proxyWorkspaceDraftEventsApiRequest,
  proxyWorkspaceDraftListApiRequest,
} from "../src/draft/proxy-workspace-draft-api.server";

describe("proxy-workspace-draft-api.spec.ts", () => {
  it("WEB-P11-3-04 list proxy returns 401 without session", async () => {
    const response = await proxyWorkspaceDraftListApiRequest(
      new Request("http://localhost/api/workspaces/ws-test/drafts"),
      { workspaceId: "ws-test" }
    );
    assert.equal(response.status, 401);
    const body = (await response.json()) as Record<string, unknown>;
    const error = body.error as Record<string, unknown>;
    assert.equal(error.code, "AUTH_UNAUTHENTICATED");
  });

  it("WEB-P11-3-04 snapshot proxy returns 401 without session", async () => {
    const response = await proxyWorkspaceDraftApiRequest(
      new Request("http://localhost/api/workspaces/ws-test/drafts/operator.wizard/key"),
      {
        workspaceId: "ws-test",
        namespace: "operator.wizard",
        key: "key",
        method: "GET",
      }
    );
    assert.equal(response.status, 401);
  });

  it("WEB-P11-3-15 DELETE proxy forwards backend 204 without JSON body", async () => {
    const originalFetch = globalThis.fetch;
    const originalApiUrl = process.env.TOUR_OPS_API_URL;
    process.env.TOUR_OPS_API_URL = "http://api.test";
    globalThis.fetch = (async () =>
      new Response(null, { status: 204 })) as typeof globalThis.fetch;

    try {
      const response = await proxyWorkspaceDraftApiRequest(
        new Request("http://denali.localhost/api/workspaces/ws-test/drafts/operator.wizard/key", {
          headers: { authorization: "Bearer test-token" },
        }),
        {
          workspaceId: "ws-test",
          namespace: "operator.wizard",
          key: "key",
          method: "DELETE",
        }
      );
      assert.equal(response.status, 204);
      assert.equal(await response.text(), "");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalApiUrl === undefined) {
        delete process.env.TOUR_OPS_API_URL;
      } else {
        process.env.TOUR_OPS_API_URL = originalApiUrl;
      }
    }
  });

  it("WEB-P11-9-01 events proxy returns 401 without session", async () => {
    const response = await proxyWorkspaceDraftEventsApiRequest(
      new Request("http://localhost/api/workspaces/ws-test/drafts/operator.wizard/key/events"),
      {
        workspaceId: "ws-test",
        namespace: "operator.wizard",
        key: "key",
      }
    );
    assert.equal(response.status, 401);
  });

  it("WEB-P11-3-19 GET proxy maps WORKSPACE_DRAFT_NOT_FOUND 404 to 204", async () => {
    const originalFetch = globalThis.fetch;
    const originalApiUrl = process.env.TOUR_OPS_API_URL;
    process.env.TOUR_OPS_API_URL = "http://api.test";
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ error: "not_found", code: "WORKSPACE_DRAFT_NOT_FOUND" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )) as typeof globalThis.fetch;

    try {
      const response = await proxyWorkspaceDraftApiRequest(
        new Request("http://denali.localhost/api/workspaces/ws-test/drafts/operator.wizard/key", {
          headers: { authorization: "Bearer test-token" },
        }),
        {
          workspaceId: "ws-test",
          namespace: "operator.wizard",
          key: "key",
          method: "GET",
        }
      );
      assert.equal(response.status, 204);
      assert.equal(await response.text(), "");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalApiUrl === undefined) {
        delete process.env.TOUR_OPS_API_URL;
      } else {
        process.env.TOUR_OPS_API_URL = originalApiUrl;
      }
    }
  });

  it("WEB-P11-TIMEOUT-04 draft snapshot proxy installs a timeout signal", async () => {
    const originalFetch = globalThis.fetch;
    const originalApiUrl = process.env.TOUR_OPS_API_URL;
    process.env.TOUR_OPS_API_URL = "http://api.test";
    let capturedSignal: AbortSignal | null = null;
    globalThis.fetch = (async (_input, init) => {
      capturedSignal = init?.signal instanceof AbortSignal ? init.signal : null;
      return new Response(null, { status: 204 });
    }) as typeof globalThis.fetch;

    try {
      const response = await proxyWorkspaceDraftApiRequest(
        new Request("http://denali.localhost/api/workspaces/ws-test/drafts/operator.wizard/key", {
          headers: { authorization: "Bearer test-token" },
        }),
        {
          workspaceId: "ws-test",
          namespace: "operator.wizard",
          key: "key",
          method: "GET",
        }
      );
      assert.equal(response.status, 204);
      assert.ok(capturedSignal, "expected proxy fetch to install AbortSignal.timeout");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalApiUrl === undefined) {
        delete process.env.TOUR_OPS_API_URL;
      } else {
        process.env.TOUR_OPS_API_URL = originalApiUrl;
      }
    }
  });
});
