"use client";

import { useDraftEngine } from "@app-tour/draft-engine/react";
import { useEffect, useMemo } from "react";

import { createWorkspaceDraftAdapter } from "./create-workspace-draft-adapter";
import {
  useDraftPersistencePublisher,
  useDraftRuntimeCoordination,
} from "./use-draft-runtime-coordination";
import { useDraftVisibilityFlush } from "./use-draft-visibility-flush";
import type { UseWorkspaceDraftOptions, WorkspaceDraftHookResult } from "./workspace-draft-types";

export function useWorkspaceDraft<T>(
  options: UseWorkspaceDraftOptions<T>
): WorkspaceDraftHookResult<T> {
  const { publishPersistence } = useDraftPersistencePublisher({
    workspaceId: options.workspaceId,
    namespace: options.namespace,
    draftKey: options.draftKey,
  });
  const adapter = useMemo(
    () =>
      createWorkspaceDraftAdapter<T>({
        ...options,
        onPersisted: publishPersistence,
      }),
    [
      options.workspaceId,
      options.namespace,
      options.draftKey,
      options.id,
      options.conflictStrategy,
      options.debounceMs,
      options.autoApply,
      options.merge,
      options.onPushSuccess,
      options.schemaGate,
      options.normalizeRemote,
      options.shouldBypassServerVersionAdoption,
      publishPersistence,
    ]
  );

  const { state, setDraftData, retry, flush, flushKeepalive, initialize, clearDraft, clearDraftAndReset, applyDraft, revertToLastValid } =
    useDraftEngine(adapter);

  const { isOnline, externalUpdateAvailable } = useDraftRuntimeCoordination({
    workspaceId: options.workspaceId,
    namespace: options.namespace,
    draftKey: options.draftKey,
    status: state.status,
    initialize,
    flush,
    retry,
  });

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
  const canRevertQuarantine =
    state.status === "QUARANTINED" && state.hasLastValidSnapshot === true;

  return useMemo(
    () => ({
      data: state.data,
      status: state.status,
      version: state.version,
      schemaVersion: state.schemaVersion,
      lastModified: state.lastModified,
      error: state.error,
      pendingDraft: state.pendingDraft,
      schemaIssues: state.schemaIssues,
      conflictReloadNotice: state.conflictReloadNotice === true,
      canRevertQuarantine,
      navLocked,
      isOnline,
      externalUpdateAvailable,
      setData: setDraftData,
      retry,
      clearDraft,
      clearDraftAndReset,
      applyDraft,
      flush,
      initialize,
      revertToLastValid,
    }),
    [
      state.data,
      state.status,
      state.version,
      state.schemaVersion,
      state.lastModified,
      state.error,
      state.pendingDraft,
      state.schemaIssues,
      state.conflictReloadNotice,
      canRevertQuarantine,
      navLocked,
      isOnline,
      externalUpdateAvailable,
      setDraftData,
      retry,
      clearDraft,
      clearDraftAndReset,
      applyDraft,
      flush,
      initialize,
      revertToLastValid,
    ]
  );
}
