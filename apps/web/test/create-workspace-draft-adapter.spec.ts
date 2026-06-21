/**
 * Phase 1 — push-time AbortController in workspace draft adapter
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { DraftEngine } from "@app-tour/draft-engine";

import { createWorkspaceDraftAdapter } from "../src/draft/create-workspace-draft-adapter";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type TestData = { readonly value: string };

type FetchImpl = typeof globalThis.fetch;

describe("create-workspace-draft-adapter.spec.ts — Phase 1 abort", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("WEB-P11-3-07 second onPush aborts first in-flight PATCH signal", async () => {
    const signals: AbortSignal[] = [];
    let resolveFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    globalThis.fetch = (async (_input, init) => {
      const signal = init?.signal;
      if (signal != null) {
        signals.push(signal);
      }
      const callIndex = signals.length;
      if (callIndex === 1) {
        await firstGate;
        if (signal?.aborted) {
          throw new DOMException("The operation was aborted.", "AbortError");
        }
      }
      const body =
        init?.body != null && typeof init.body === "string"
          ? (JSON.parse(init.body) as { data?: TestData })
          : null;
      const value = body?.data?.value ?? "unknown";
      return new Response(
        JSON.stringify({
          data: { value },
          version: callIndex,
          schemaVersion: 1,
          lastModified: 100,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }) as FetchImpl;

    const adapter = createWorkspaceDraftAdapter<TestData>({
      workspaceId: "ws-test",
      namespace: "operator.wizard",
      draftKey: "test-draft",
    });

    const payload = (value: string) => ({
      data: { value },
      version: 0,
      schemaVersion: 1,
      lastModified: 100,
    });

    const firstPush = adapter.onPush(payload("first"));
    const secondPush = adapter.onPush(payload("second"));
    resolveFirst?.();
    await Promise.allSettled([firstPush, secondPush]);

    assert.equal(signals.length, 2);
    assert.equal(signals[0]?.aborted, true);
    assert.equal(signals[1]?.aborted, false);
    const secondResult = await secondPush;
    assert.equal(secondResult.data.value, "second");
  });

  it("WEB-P11-3-11 keepalive onPush does not abort in-flight PATCH signal", async () => {
    const signals: AbortSignal[] = [];
    const keepaliveFlags: boolean[] = [];
    let resolveFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    globalThis.fetch = (async (_input, init) => {
      keepaliveFlags.push(init?.keepalive === true);
      const signal = init?.signal;
      if (signal != null) {
        signals.push(signal);
      }
      const isKeepalive = init?.keepalive === true;
      if (!isKeepalive && signals.length === 1) {
        await firstGate;
        if (signal?.aborted) {
          throw new DOMException("The operation was aborted.", "AbortError");
        }
      }
      const body =
        init?.body != null && typeof init.body === "string"
          ? (JSON.parse(init.body) as { data?: TestData })
          : null;
      const value = body?.data?.value ?? "unknown";
      return new Response(
        JSON.stringify({
          data: { value },
          version: keepaliveFlags.length,
          schemaVersion: 1,
          lastModified: 100,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }) as FetchImpl;

    const adapter = createWorkspaceDraftAdapter<TestData>({
      workspaceId: "ws-test",
      namespace: "operator.wizard",
      draftKey: "test-draft-keepalive",
    });

    const payload = {
      data: { value: "first" },
      version: 0,
      schemaVersion: 1,
      lastModified: 100,
    };

    const firstPush = adapter.onPush(payload);
    const keepalivePush = adapter.onPush(payload, { keepalive: true });
    resolveFirst?.();
    await Promise.all([firstPush, keepalivePush]);

    assert.equal(signals.length, 1);
    assert.equal(signals[0]?.aborted, false);
    assert.deepEqual(keepaliveFlags, [false, true]);
  });

  it("WEB-P11-3-13 adapter forwards intentId as Idempotency-Key on non-keepalive PATCH", async () => {
    let capturedKey: string | null = null;
    globalThis.fetch = (async (_input, init) => {
      const headers = new Headers(init?.headers);
      capturedKey = headers.get("Idempotency-Key");
      return new Response(
        JSON.stringify({
          data: { value: "saved" },
          version: 1,
          schemaVersion: 1,
          lastModified: 100,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }) as FetchImpl;

    const adapter = createWorkspaceDraftAdapter<TestData>({
      workspaceId: "ws-test",
      namespace: "operator.wizard",
      draftKey: "intent-forward",
    });

    await adapter.onPush(
      {
        data: { value: "saved" },
        version: 0,
        schemaVersion: 1,
        lastModified: 100,
      },
      { intentId: "push-intent-uuid-123" }
    );

    assert.equal(capturedKey, "push-intent-uuid-123");
  });

  it("WEB-P11-3-14 clearDraft aborts in-flight PATCH before DELETE", async () => {
    let deleteCalled = false;
    let resolvePush: (() => void) | undefined;
    const pushGate = new Promise<void>((resolve) => {
      resolvePush = resolve;
    });

    globalThis.fetch = (async (_input, init) => {
      const method = init?.method ?? "GET";
      if (method === "GET") {
        return new Response(null, { status: 404 });
      }
      if (method === "DELETE") {
        deleteCalled = true;
        return new Response(null, { status: 204 });
      }
      await pushGate;
      if (init?.signal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      return new Response(
        JSON.stringify({
          data: { value: "stale" },
          version: 2,
          schemaVersion: 1,
          lastModified: 100,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as FetchImpl;

    const adapter = createWorkspaceDraftAdapter<TestData>({
      workspaceId: "ws-test",
      namespace: "operator.wizard",
      draftKey: "clear-abort",
    });
    const engine = new DraftEngine<TestData>(adapter);
    await engine.initialize();
    engine.setDraftData({ value: "dirty" });
    const pushPromise = engine.flush();
    await sleep(5);
    const clearPromise = engine.clearDraft();
    resolvePush?.();
    await Promise.allSettled([pushPromise, clearPromise]);

    assert.equal(deleteCalled, true);
    assert.equal(engine.getState().data, null);
    assert.equal(engine.getState().version, 0);
  });

  it("WEB-P11-C-08 SERVER_WINS 409 applies server payload and sets conflictReloadNotice", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: { value: "server-authoritative" },
          version: 42,
          schemaVersion: 1,
          lastModified: 9000,
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }
      )) as FetchImpl;

    const adapter = createWorkspaceDraftAdapter<TestData>({
      workspaceId: "ws-test",
      namespace: "operator.wizard",
      draftKey: "server-wins-conflict",
      conflictStrategy: "SERVER_WINS",
    });

    const engine = new DraftEngine<TestData>(adapter);
    await engine.initialize();
    engine.setDraftData({ value: "local-edit" });
    await engine.flush();

    const state = engine.getState();
    assert.equal(state.status, "IDLE");
    assert.equal(state.data?.value, "server-authoritative");
    assert.equal(state.version, 42);
    assert.equal(state.conflictReloadNotice, true);

    engine.setDraftData({ value: "operator-edit" });
    assert.equal(engine.getState().conflictReloadNotice, undefined);
  });

  it("WEB-P11-3-15 identical in-flight payload JSON does not abort first PATCH signal", async () => {
    const signals: AbortSignal[] = [];
    let resolveFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    globalThis.fetch = (async (_input, init) => {
      const signal = init?.signal;
      if (signal != null) {
        signals.push(signal);
      }
      const callIndex = signals.length;
      if (callIndex === 1) {
        await firstGate;
        if (signal?.aborted) {
          throw new DOMException("The operation was aborted.", "AbortError");
        }
      }
      return new Response(
        JSON.stringify({
          data: { value: "same" },
          version: callIndex,
          schemaVersion: 1,
          lastModified: 100,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }) as FetchImpl;

    const adapter = createWorkspaceDraftAdapter<TestData>({
      workspaceId: "ws-test",
      namespace: "operator.wizard",
      draftKey: "same-payload-no-abort",
    });

    const payload = {
      data: { value: "same" },
      version: 0,
      schemaVersion: 1,
      lastModified: 100,
    };

    const firstPush = adapter.onPush(payload);
    const secondPush = adapter.onPush(payload);
    resolveFirst?.();
    await Promise.allSettled([firstPush, secondPush]);

    assert.ok(signals.length >= 1);
    assert.equal(signals[0]?.aborted, false);
  });
});
