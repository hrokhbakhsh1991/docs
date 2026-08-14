import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { cleanup, render, waitFor } from "@testing-library/react";
import React from "react";

import {
  buildDraftCrossTabChannelKey,
  buildDraftCrossTabStorageKey,
} from "../src/draft/draft-cross-tab-sync";
import { useDraftRuntimeCoordination } from "../src/draft/use-draft-runtime-coordination";

function RuntimeCoordinationProbe(props: {
  readonly status: "IDLE" | "DIRTY" | "ERROR";
  readonly onInitialize: () => Promise<void>;
  readonly onFlush: () => Promise<void>;
  readonly onRetry: () => Promise<void>;
}) {
  const state = useDraftRuntimeCoordination({
    workspaceId: "ws-test",
    namespace: "operator.wizard",
    draftKey: "draft-1",
    status: props.status,
    initialize: props.onInitialize,
    flush: props.onFlush,
    retry: props.onRetry,
  });

  return (
    <>
      <output data-testid="online-state">{String(state.isOnline)}</output>
      <output data-testid="external-update">{String(state.externalUpdateAvailable)}</output>
    </>
  );
}

describe("use-draft-runtime-coordination", () => {
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("hydrates immediately when another tab reports a saved draft and local state is IDLE", async () => {
    let initializeCalls = 0;
    const view = render(
      <RuntimeCoordinationProbe
        status="IDLE"
        onInitialize={async () => {
          initializeCalls += 1;
        }}
        onFlush={async () => {}}
        onRetry={async () => {}}
      />
    );

    const event = new StorageEvent("storage", {
      key: buildDraftCrossTabStorageKey(
        buildDraftCrossTabChannelKey("ws-test", "operator.wizard", "draft-1")
      ),
      newValue: JSON.stringify({
        sourceId: "different-tab",
        action: "saved",
        emittedAt: Date.now(),
      }),
    });
    window.dispatchEvent(event);

    await waitFor(() => {
      assert.equal(initializeCalls, 1);
      assert.equal(view.getByTestId("external-update").textContent, "false");
    });
  });

  it("marks pending external update when another tab changes the draft while local state is DIRTY", async () => {
    const view = render(
      <RuntimeCoordinationProbe
        status="DIRTY"
        onInitialize={async () => {}}
        onFlush={async () => {}}
        onRetry={async () => {}}
      />
    );

    const event = new StorageEvent("storage", {
      key: buildDraftCrossTabStorageKey(
        buildDraftCrossTabChannelKey("ws-test", "operator.wizard", "draft-1")
      ),
      newValue: JSON.stringify({
        sourceId: "different-tab",
        action: "saved",
        emittedAt: Date.now(),
      }),
    });
    window.dispatchEvent(event);

    await waitFor(() => {
      assert.equal(view.getByTestId("external-update").textContent, "true");
    });
  });

  it("flushes dirty changes after the browser comes back online", async () => {
    let flushCalls = 0;
    const view = render(
      <RuntimeCoordinationProbe
        status="DIRTY"
        onInitialize={async () => {}}
        onFlush={async () => {
          flushCalls += 1;
        }}
        onRetry={async () => {}}
      />
    );

    window.dispatchEvent(new Event("offline"));
    await waitFor(() => {
      assert.equal(view.getByTestId("online-state").textContent, "false");
    });

    window.dispatchEvent(new Event("online"));
    await waitFor(() => {
      assert.equal(flushCalls, 1);
      assert.equal(view.getByTestId("online-state").textContent, "true");
    });
  });

  it("retries failed sync after the browser comes back online", async () => {
    let retryCalls = 0;
    render(
      <RuntimeCoordinationProbe
        status="ERROR"
        onInitialize={async () => {}}
        onFlush={async () => {}}
        onRetry={async () => {
          retryCalls += 1;
        }}
      />
    );

    window.dispatchEvent(new Event("online"));
    await waitFor(() => {
      assert.equal(retryCalls, 1);
    });
  });
});
