"use client";

import type { DraftStatus } from "@app-tour/draft-engine";
import { useEffect, useRef } from "react";

import { resolveVisibilityFlushAction } from "./draft-visibility-flush-logic";

export type UseDraftVisibilityFlushOptions = {
  readonly enabled?: boolean;
  readonly status: DraftStatus;
  readonly flush: () => Promise<void>;
  readonly flushKeepalive: () => void;
};

export function useDraftVisibilityFlush({
  enabled = true,
  status,
  flush,
  flushKeepalive,
}: UseDraftVisibilityFlushOptions): void {
  const statusRef = useRef(status);
  statusRef.current = status;

  const flushRef = useRef(flush);
  flushRef.current = flush;

  const flushKeepaliveRef = useRef(flushKeepalive);
  flushKeepaliveRef.current = flushKeepalive;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onVisibilityChange = () => {
      const action = resolveVisibilityFlushAction(
        statusRef.current,
        "visibilitychange",
        document.visibilityState
      );
      if (action === "flush") {
        void flushRef.current();
      }
    };

    const onPageHide = () => {
      const action = resolveVisibilityFlushAction(
        statusRef.current,
        "pagehide",
        document.visibilityState
      );
      if (action === "keepalive") {
        flushKeepaliveRef.current();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [enabled]);
}
