"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchWorkspaceDraftIndex } from "./workspace-draft-client";
import type { WorkspaceDraftIndexItem } from "./workspace-draft-types";

export type UseWorkspaceDraftIndexResult = {
  readonly items: readonly WorkspaceDraftIndexItem[];
  readonly loading: boolean;
  readonly error: Error | null;
  readonly refresh: () => Promise<void>;
};

export type UseWorkspaceDraftIndexOptions = {
  readonly enabled?: boolean;
};

export function useWorkspaceDraftIndex(
  workspaceId: string | undefined,
  namespace?: string,
  options?: UseWorkspaceDraftIndexOptions
): UseWorkspaceDraftIndexResult {
  const enabled = options?.enabled !== false;
  const [items, setItems] = useState<readonly WorkspaceDraftIndexItem[]>([]);
  const [loading, setLoading] = useState(workspaceId !== undefined && enabled);
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
    if (workspaceId === undefined || !enabled) {
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
      const response = await fetchWorkspaceDraftIndex(workspaceId, namespace);
      if (mountedRef.current && requestVersionRef.current === requestVersion) {
        setItems(response.items);
      }
    } catch (cause) {
      if (mountedRef.current && requestVersionRef.current === requestVersion) {
        setError(cause instanceof Error ? cause : new Error("WORKSPACE_DRAFT_INDEX_FAILED"));
        setItems([]);
      }
    } finally {
      if (mountedRef.current && requestVersionRef.current === requestVersion) {
        setLoading(false);
      }
    }
  }, [enabled, namespace, workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
