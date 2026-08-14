import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { cleanup, render } from "@testing-library/react";
import React from "react";

import { useDraftVisibilityFlush } from "../src/draft/use-draft-visibility-flush";

function VisibilityFlushProbe(): null {
  useDraftVisibilityFlush({
    enabled: true,
    status: "DIRTY",
    flush: async () => {},
    flushKeepalive: () => {},
  });
  return null;
}

describe("use-draft-visibility-flush", () => {
  afterEach(() => {
    cleanup();
  });

  it("registers visibilitychange on document and pagehide on window", () => {
    const originalDocumentAdd = document.addEventListener.bind(document);
    const originalDocumentRemove = document.removeEventListener.bind(document);
    const originalWindowAdd = window.addEventListener.bind(window);
    const originalWindowRemove = window.removeEventListener.bind(window);
    const documentEvents: string[] = [];
    const windowEvents: string[] = [];

    document.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject) => {
      documentEvents.push(type);
      return originalDocumentAdd(type, listener);
    }) as typeof document.addEventListener;
    document.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject) => {
      return originalDocumentRemove(type, listener);
    }) as typeof document.removeEventListener;
    window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject) => {
      windowEvents.push(type);
      return originalWindowAdd(type, listener);
    }) as typeof window.addEventListener;
    window.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject) => {
      return originalWindowRemove(type, listener);
    }) as typeof window.removeEventListener;

    try {
      render(<VisibilityFlushProbe />);
      assert.ok(documentEvents.includes("visibilitychange"));
      assert.ok(windowEvents.includes("pagehide"));
    } finally {
      document.addEventListener = originalDocumentAdd;
      document.removeEventListener = originalDocumentRemove;
      window.addEventListener = originalWindowAdd;
      window.removeEventListener = originalWindowRemove;
    }
  });
});
