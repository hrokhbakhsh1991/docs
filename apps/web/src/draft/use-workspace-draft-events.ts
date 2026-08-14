"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchWorkspaceDraftEvents } from "./workspace-draft-client";
import type { WorkspaceDraftEventListItem } from "./workspace-draft-types";

const WORKSPACE_DRAFT_EVENTS_FETCH_LIMIT = 20;

export type UseWorkspaceDraftEventsResult = {
  readonly items: readonly WorkspaceDraftEventListItem[];
  readonly loading: boolean;
  readonly error: Error | null;
  readonly refresh: () => Promise<void>;
};

export function useWorkspaceDraftEvents(
  workspaceId: string | undefined,
  namespace: string,
  draftKey: string,
  refreshToken = 0
): UseWorkspaceDraftEventsResult {
  const [items, setItems] = useState<readonly WorkspaceDraftEventListItem[]>([]);
  const [loading, setLoading] = useState(workspaceId !== undefined);
  const [error, setError] = useState<Error | null>(null);
  const requestVersionRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    if (workspaceId === undefined) {
      if (mountedRef.current && requestVersionRef.current === requestVersion) {
        setItems([]);
        setLoading(false);
        setError(null);
      }
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWorkspaceDraftEvents(
        workspaceId,
        namespace,
        draftKey,
        WORKSPACE_DRAFT_EVENTS_FETCH_LIMIT
      );
      if (mountedRef.current && requestVersionRef.current === requestVersion) {
        setItems(response.items);
      }
    } catch (cause) {
      if (mountedRef.current && requestVersionRef.current === requestVersion) {
        setError(cause instanceof Error ? cause : new Error("WORKSPACE_DRAFT_EVENTS_FAILED"));
        setItems([]);
      }
    } finally {
      if (mountedRef.current && requestVersionRef.current === requestVersion) {
        setLoading(false);
      }
    }
  }, [workspaceId, namespace, draftKey]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshToken]);

  return { items, loading, error, refresh };
}
