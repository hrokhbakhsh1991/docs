import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { cleanup, render, waitFor } from "@testing-library/react";
import React from "react";

import { useWorkspaceDraftEvents } from "../src/draft/use-workspace-draft-events";
import { useWorkspaceDraftIndex } from "../src/draft/use-workspace-draft-index";

type DeferredResponse = {
  readonly promise: Promise<Response>;
  readonly resolve: (_response: Response) => void;
};

function createDeferredResponse(): DeferredResponse {
  let resolve!: (_response: Response) => void;
  const promise = new Promise<Response>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

function DraftIndexProbe(props: { readonly namespace: string }) {
  const result = useWorkspaceDraftIndex("ws-test", props.namespace);
  return <output data-testid="draft-index-items">{result.items.map((item) => item.draftKey).join(",")}</output>;
}

function DraftEventsProbe(props: { readonly draftKey: string }) {
  const result = useWorkspaceDraftEvents("ws-test", "operator.wizard", props.draftKey);
  return <output data-testid="draft-events-items">{result.items.map((item) => item.id).join(",")}</output>;
}

describe("workspace draft async guards", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    cleanup();
  });

  it("index hook ignores a slower stale response after namespace changes", async () => {
    const deferred = createDeferredResponse();
    globalThis.fetch = (async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("namespace=first")) {
        return deferred.promise;
      }
      return new Response(
        JSON.stringify({
          items: [
            {
              draftNamespace: "operator.wizard",
              draftKey: "second-result",
              version: 1,
              schemaVersion: 1,
              lastModified: 100,
              updatedAt: "2026-08-14T12:00:00.000Z",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const view = render(<DraftIndexProbe namespace="first" />);
    view.rerender(<DraftIndexProbe namespace="second" />);

    await waitFor(() => {
      assert.equal(view.getByTestId("draft-index-items").textContent, "second-result");
    });

    deferred.resolve(
      new Response(
        JSON.stringify({
          items: [
            {
              draftNamespace: "operator.wizard",
              draftKey: "stale-first",
              version: 1,
              schemaVersion: 1,
              lastModified: 100,
              updatedAt: "2026-08-14T12:00:00.000Z",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(view.getByTestId("draft-index-items").textContent, "second-result");
  });

  it("events hook ignores a slower stale response after draft key changes", async () => {
    const deferred = createDeferredResponse();
    globalThis.fetch = (async (input) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/first/events")) {
        return deferred.promise;
      }
      return new Response(
        JSON.stringify({
          items: [
            {
              id: "evt-second",
              action: "updated",
              version: 1,
              schemaVersion: 1,
              actorUserId: "user-1",
              occurredAt: "2026-08-14T12:00:00.000Z",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const view = render(<DraftEventsProbe draftKey="first" />);
    view.rerender(<DraftEventsProbe draftKey="second" />);

    await waitFor(() => {
      assert.equal(view.getByTestId("draft-events-items").textContent, "evt-second");
    });

    deferred.resolve(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "evt-stale-first",
              action: "updated",
              version: 1,
              schemaVersion: 1,
              actorUserId: "user-1",
              occurredAt: "2026-08-14T12:00:00.000Z",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(view.getByTestId("draft-events-items").textContent, "evt-second");
  });
});
