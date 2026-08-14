"use client";

import type { DraftStatus } from "@app-tour/draft-engine";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  buildDraftCrossTabChannelKey,
  getDraftCrossTabSourceId,
  publishDraftCrossTabMessage,
  subscribeDraftCrossTabMessages,
  type DraftCrossTabSyncMessage,
} from "./draft-cross-tab-sync";

type UseDraftRuntimeCoordinationOptions = {
  readonly workspaceId: string;
  readonly namespace: string;
  readonly draftKey: string;
  readonly status: DraftStatus;
  readonly initialize: () => Promise<void>;
  readonly flush: () => Promise<void>;
  readonly retry: () => Promise<void>;
};

export type DraftPersistenceAction = "saved" | "cleared";

export type UseDraftRuntimeCoordinationResult = {
  readonly isOnline: boolean;
  readonly externalUpdateAvailable: boolean;
};

export type UseDraftPersistencePublisherResult = {
  readonly publishPersistence: (_action: DraftPersistenceAction) => void;
};

function canHydrateRemotely(status: DraftStatus): boolean {
  return status === "IDLE" || status === "DRAFT_AVAILABLE";
}

export function useDraftRuntimeCoordination({
  workspaceId,
  namespace,
  draftKey,
  status,
  initialize,
  flush,
  retry,
}: UseDraftRuntimeCoordinationOptions): UseDraftRuntimeCoordinationResult {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [externalUpdateAvailable, setExternalUpdateAvailable] = useState(false);
  const statusRef = useRef(status);
  statusRef.current = status;
  const initializeRef = useRef(initialize);
  initializeRef.current = initialize;
  const flushRef = useRef(flush);
  flushRef.current = flush;
  const retryRef = useRef(retry);
  retryRef.current = retry;
  const sourceIdRef = useRef(getDraftCrossTabSourceId());
  const channelKey = buildDraftCrossTabChannelKey(workspaceId, namespace, draftKey);

  const handleExternalMessage = useCallback((message: DraftCrossTabSyncMessage) => {
    if (message.sourceId === sourceIdRef.current) {
      return;
    }
    if (canHydrateRemotely(statusRef.current)) {
      setExternalUpdateAvailable(false);
      void initializeRef.current();
      return;
    }
    setExternalUpdateAvailable(true);
  }, []);

  useEffect(() => {
    return subscribeDraftCrossTabMessages(channelKey, handleExternalMessage);
  }, [channelKey, handleExternalMessage]);

  useEffect(() => {
    if (!externalUpdateAvailable || !canHydrateRemotely(status)) {
      return;
    }
    setExternalUpdateAvailable(false);
    void initializeRef.current();
  }, [externalUpdateAvailable, status]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleOnline = () => {
      setIsOnline(true);
      if (statusRef.current === "DIRTY") {
        void flushRef.current();
        return;
      }
      if (statusRef.current === "ERROR" || statusRef.current === "QUARANTINED") {
        void retryRef.current();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, externalUpdateAvailable };
}

export function useDraftPersistencePublisher({
  workspaceId,
  namespace,
  draftKey,
}: Pick<UseDraftRuntimeCoordinationOptions, "workspaceId" | "namespace" | "draftKey">): UseDraftPersistencePublisherResult {
  const sourceIdRef = useRef(getDraftCrossTabSourceId());
  const channelKey = buildDraftCrossTabChannelKey(workspaceId, namespace, draftKey);

  const publishPersistence = useCallback(
    (action: DraftPersistenceAction) => {
      publishDraftCrossTabMessage(channelKey, {
        sourceId: sourceIdRef.current,
        action,
        emittedAt: Date.now(),
      });
    },
    [channelKey]
  );

  return { publishPersistence };
}
