/**
 * Phase 11.3 — workspace draft BFF client (WEB-P11-3-01, WEB-P11-3-02)
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { DraftConflictError } from "@app-tour/draft-engine";

import {
  deleteWorkspaceDraftSnapshot,
  deleteWorkspaceDraftSnapshotVerified,
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
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
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
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
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

  it("WEB-P11-3-09 PATCH with keepalive passes keepalive to fetch", async () => {
    let fetchInit: RequestInit | undefined;
    globalThis.fetch = (async (_input, init) => {
      fetchInit = init;
      return new Response(
        JSON.stringify({
          data: { title: "saved" },
          version: 2,
          schemaVersion: 1,
          lastModified: 200,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }) as FetchImpl;

    await patchWorkspaceDraftSnapshot(
      WORKSPACE_ID,
      NAMESPACE,
      KEY,
      {
        data: { title: "saved" },
        version: 1,
        schemaVersion: 1,
        lastModified: 100,
      },
      { keepalive: true }
    );

    assert.equal(fetchInit?.keepalive, true);
    assert.equal(fetchInit?.signal, undefined);
  });

  it("WEB-P11-3-10 PATCH sends Idempotency-Key when intentId provided", async () => {
    let fetchInit: RequestInit | undefined;
    globalThis.fetch = (async (_input, init) => {
      fetchInit = init;
      return new Response(
        JSON.stringify({
          data: { title: "saved" },
          version: 2,
          schemaVersion: 1,
          lastModified: 200,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }) as FetchImpl;

    await patchWorkspaceDraftSnapshot(
      WORKSPACE_ID,
      NAMESPACE,
      KEY,
      {
        data: { title: "saved" },
        version: 1,
        schemaVersion: 1,
        lastModified: 100,
      },
      { intentId: "intent-abc-123" }
    );

    const headers = new Headers(fetchInit?.headers);
    assert.equal(headers.get("Idempotency-Key"), "intent-abc-123");
  });

  it("WEB-P11-3-12 PATCH keepalive omits Idempotency-Key even when intentId provided", async () => {
    let fetchInit: RequestInit | undefined;
    globalThis.fetch = (async (_input, init) => {
      fetchInit = init;
      return new Response(
        JSON.stringify({
          data: { title: "saved" },
          version: 2,
          schemaVersion: 1,
          lastModified: 200,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }) as FetchImpl;

    await patchWorkspaceDraftSnapshot(
      WORKSPACE_ID,
      NAMESPACE,
      KEY,
      {
        data: { title: "saved" },
        version: 1,
        schemaVersion: 1,
        lastModified: 100,
      },
      { keepalive: true, intentId: "intent-should-not-send" }
    );

    const headers = new Headers(fetchInit?.headers);
    assert.equal(headers.get("Idempotency-Key"), null);
  });

  it("WEB-P11-3-04 PATCH 502 with HTML body throws PATCH_FAILED not SyntaxError", async () => {
    globalThis.fetch = (async () =>
      new Response("<!DOCTYPE html><html><body>Bad Gateway</body></html>", {
        status: 502,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })) as FetchImpl;

    await assert.rejects(
      () =>
        patchWorkspaceDraftSnapshot(WORKSPACE_ID, NAMESPACE, KEY, {
          data: { title: "local" },
          version: 1,
          schemaVersion: 1,
          lastModified: 50,
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "WORKSPACE_DRAFT_PATCH_FAILED:502");
        assert.notEqual(error.name, "SyntaxError");
        return true;
      }
    );
  });

  it("WEB-P11-3-06 PATCH 409 with non-JSON body throws PATCH_FAILED:409", async () => {
    globalThis.fetch = (async () =>
      new Response("<html>conflict</html>", {
        status: 409,
        headers: { "Content-Type": "text/html" },
      })) as FetchImpl;

    await assert.rejects(
      () =>
        patchWorkspaceDraftSnapshot(WORKSPACE_ID, NAMESPACE, KEY, {
          data: { title: "local" },
          version: 1,
          schemaVersion: 1,
          lastModified: 50,
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "WORKSPACE_DRAFT_PATCH_FAILED:409");
        assert.ok(!(error instanceof DraftConflictError));
        return true;
      }
    );
  });

  it("WEB-P11-3-05 DELETE treats 404 as success", async () => {
    globalThis.fetch = (async () => new Response("{}", { status: 404 })) as FetchImpl;
    await deleteWorkspaceDraftSnapshot(WORKSPACE_ID, NAMESPACE, KEY);
  });

  it("WEB-P11-3-16 DELETE treats 204 as success", async () => {
    globalThis.fetch = (async () => new Response(null, { status: 204 })) as FetchImpl;
    await deleteWorkspaceDraftSnapshot(WORKSPACE_ID, NAMESPACE, KEY);
  });

  it("WEB-P11-3-17 verified DELETE retries when GET still returns row", async () => {
    let getCalls = 0;
    globalThis.fetch = (async (_input, init) => {
      const method = init?.method ?? "GET";
      if (method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      getCalls += 1;
      if (getCalls === 1) {
        return new Response(
          JSON.stringify({
            data: { title: "stale" },
            version: 3,
            schemaVersion: 1,
            lastModified: 100,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
    }) as FetchImpl;

    await deleteWorkspaceDraftSnapshotVerified(WORKSPACE_ID, NAMESPACE, KEY);
    assert.equal(getCalls, 2);
  });

  it("WEB-P11-3-18 verified DELETE 404 skips verify GET (no noisy second fetch)", async () => {
    let fetchCalls = 0;
    globalThis.fetch = (async (_input, init) => {
      fetchCalls += 1;
      const method = init?.method ?? "GET";
      if (method === "DELETE") {
        return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
      }
      throw new Error("unexpected GET after DELETE 404");
    }) as FetchImpl;

    await deleteWorkspaceDraftSnapshotVerified(WORKSPACE_ID, NAMESPACE, KEY);
    assert.equal(fetchCalls, 1);
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
