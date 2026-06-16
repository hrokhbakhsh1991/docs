"use client";

import { useDraftEngine } from "@app-tour/draft-engine/react";
import { useEffect, useMemo } from "react";

import { createWorkspaceDraftAdapter } from "./create-workspace-draft-adapter";
import { useDraftVisibilityFlush } from "./use-draft-visibility-flush";
import type { UseWorkspaceDraftOptions, WorkspaceDraftHookResult } from "./workspace-draft-types";

export function useWorkspaceDraft<T>(
  options: UseWorkspaceDraftOptions<T>
): WorkspaceDraftHookResult<T> {
  const adapter = useMemo(
    () => createWorkspaceDraftAdapter<T>(options),
    [
      options.workspaceId,
      options.namespace,
      options.draftKey,
      options.id,
      options.conflictStrategy,
      options.debounceMs,
      options.autoApply,
      options.merge,
    ]
  );

  const { state, setDraftData, retry, flush, flushKeepalive, initialize, clearDraft, applyDraft } =
    useDraftEngine(adapter);

  useEffect(() => {
    if (options.hydrateFromRemote === false) {
      return;
    }
    void initialize();
  }, [initialize, options.hydrateFromRemote]);

  useDraftVisibilityFlush({
    enabled: options.visibilityFlush !== false,
    status: state.status,
    flush,
    flushKeepalive,
  });

  const navLocked = state.status === "SYNCING" || state.status === "CONFLICT_RESOLVING";

  return {
    data: state.data,
    status: state.status,
    version: state.version,
    schemaVersion: state.schemaVersion,
    lastModified: state.lastModified,
    error: state.error,
    pendingDraft: state.pendingDraft,
    navLocked,
    setData: setDraftData,
    retry,
    clearDraft,
    applyDraft,
    flush,
    initialize,
  };
}
