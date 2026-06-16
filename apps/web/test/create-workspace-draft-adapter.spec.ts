/**
 * Phase 1 — push-time AbortController in workspace draft adapter
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { DraftEngine } from "@app-tour/draft-engine";

import { createWorkspaceDraftAdapter } from "../src/draft/create-workspace-draft-adapter";

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

    const engine = new DraftEngine<TestData>(adapter);
    await engine.initialize();

    engine.setDraftData({ value: "first" });
    const firstFlush = engine.flush();
    engine.setDraftData({ value: "second" });
    const secondFlush = engine.flush();
    resolveFirst?.();
    await Promise.all([firstFlush, secondFlush]);

    assert.equal(signals.length, 2);
    assert.equal(signals[0]?.aborted, true);
    assert.equal(signals[1]?.aborted, false);
    assert.equal(engine.getState().status, "IDLE");
    assert.equal(engine.getState().data?.value, "second");
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
});
