/**
 * Phase 11.3 — workspace draft BFF client (WEB-P11-3-01, WEB-P11-3-02)
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { DraftConflictError } from "@app-tour/draft-engine";

import {
  deleteWorkspaceDraftSnapshot,
  fetchWorkspaceDraftEvents,
  fetchWorkspaceDraftIndex,
  fetchWorkspaceDraftSnapshot,
  patchWorkspaceDraftSnapshot,
} from "../src/draft/workspace-draft-client";

const WORKSPACE_ID = "ws-test";
const NAMESPACE = "operator.wizard";
const KEY = "test-draft";

type FetchImpl = typeof globalThis.fetch;

describe("workspace-draft-client.spec.ts — Phase 11.3", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("WEB-P11-3-01 GET 404 returns null", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ code: "WORKSPACE_DRAFT_NOT_FOUND" }), {
        status: 404,
      })) as FetchImpl;

    const result = await fetchWorkspaceDraftSnapshot<{ title: string }>(
      WORKSPACE_ID,
      NAMESPACE,
      KEY
    );
    assert.equal(result, null);
  });

  it("WEB-P11-3-02 PATCH 409 throws DraftConflictError with server payload", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          code: "DRAFT_VERSION_CONFLICT",
          data: { title: "server" },
          version: 2,
          schemaVersion: 1,
          lastModified: 100,
        }),
        { status: 409 }
      )) as FetchImpl;

    await assert.rejects(
      () =>
        patchWorkspaceDraftSnapshot(WORKSPACE_ID, NAMESPACE, KEY, {
          data: { title: "local" },
          version: 1,
          schemaVersion: 1,
          lastModified: 50,
        }),
      (error: unknown) => {
        assert.ok(error instanceof DraftConflictError);
        assert.equal(error.serverPayload.version, 2);
        assert.deepEqual(error.serverPayload.data, { title: "server" });
        return true;
      }
    );
  });

  it("WEB-P11-3-03 PATCH 200 returns parsed payload", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: { title: "saved" },
          version: 3,
          schemaVersion: 1,
          lastModified: 200,
        }),
        { status: 200 }
      )) as FetchImpl;

    const result = await patchWorkspaceDraftSnapshot(WORKSPACE_ID, NAMESPACE, KEY, {
      data: { title: "saved" },
      version: 2,
      schemaVersion: 1,
      lastModified: 200,
    });
    assert.equal(result.version, 3);
    assert.deepEqual(result.data, { title: "saved" });
  });

  it("WEB-P11-3-05 DELETE treats 404 as success", async () => {
    globalThis.fetch = (async () => new Response("{}", { status: 404 })) as FetchImpl;
    await deleteWorkspaceDraftSnapshot(WORKSPACE_ID, NAMESPACE, KEY);
  });

  it("WEB-P11-9-02 GET list parses items without data blobs", async () => {
    globalThis.fetch = (async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      assert.match(url, /\/api\/workspaces\/ws-test\/drafts\?namespace=operator\.wizard$/);
      return new Response(
        JSON.stringify({
          items: [
            {
              draftNamespace: NAMESPACE,
              draftKey: KEY,
              version: 2,
              schemaVersion: 1,
              lastModified: 100,
              updatedAt: "2026-06-10T12:00:00.000Z",
            },
          ],
        }),
        { status: 200 }
      );
    }) as FetchImpl;

    const result = await fetchWorkspaceDraftIndex(WORKSPACE_ID, NAMESPACE);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.draftKey, KEY);
    assert.equal("data" in (result.items[0] ?? {}), false);
  });

  it("WEB-P11-9-05 GET events parses audit rows", async () => {
    globalThis.fetch = (async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      assert.match(url, /\/events$/);
      return new Response(
        JSON.stringify({
          items: [
            {
              id: "evt-1",
              action: "updated",
              version: 2,
              schemaVersion: 1,
              actorUserId: "user-1",
              occurredAt: "2026-06-11T12:00:00.000Z",
            },
          ],
        }),
        { status: 200 }
      );
    }) as FetchImpl;

    const result = await fetchWorkspaceDraftEvents(WORKSPACE_ID, NAMESPACE, KEY);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.action, "updated");
  });
});
