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
});
