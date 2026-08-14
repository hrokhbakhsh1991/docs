"use client";

import { useEffect, useState } from "react";

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

  const refresh = async () => {
    if (workspaceId === undefined || !enabled) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWorkspaceDraftIndex(workspaceId, namespace);
      setItems(response.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error("WORKSPACE_DRAFT_INDEX_FAILED"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [workspaceId, namespace, enabled]);

  return { items, loading, error, refresh };
}
