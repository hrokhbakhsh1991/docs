import type { DraftEngineConfig, DraftPushOptions } from "@app-tour/draft-engine";

import {
  deleteWorkspaceDraftSnapshot,
  fetchWorkspaceDraftSnapshot,
  patchWorkspaceDraftSnapshot,
  WORKSPACE_DRAFT_PATCH_ABORTED,
} from "./workspace-draft-client";
import type { WorkspaceDraftAdapterOptions } from "./workspace-draft-types";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function createWorkspaceDraftAdapter<T>(
  options: WorkspaceDraftAdapterOptions<T>
): DraftEngineConfig<T> {
  const workspaceId = options.workspaceId.trim();
  const namespace = options.namespace.trim();
  const draftKey = options.draftKey.trim();
  let pushAbortController: AbortController | null = null;

  return {
    id: options.id ?? `${namespace}:${draftKey}:${workspaceId}`,
    conflictStrategy: options.conflictStrategy ?? "REFETCH_REAPPLY",
    debounceMs: options.debounceMs ?? 500,
    ...(options.autoApply !== undefined ? { autoApply: options.autoApply } : {}),
    ...(options.merge !== undefined ? { merge: options.merge } : {}),
    ...(options.onPushSuccess !== undefined ? { onPushSuccess: options.onPushSuccess } : {}),
    ...(options.schemaGate !== undefined ? { schemaGate: options.schemaGate } : {}),
    ...(options.normalizeRemote !== undefined ? { normalizeRemote: options.normalizeRemote } : {}),
    onFetch: async () => fetchWorkspaceDraftSnapshot<T>(workspaceId, namespace, draftKey),
    onPush: async (payload, pushOptions?: DraftPushOptions) => {
      if (pushOptions?.keepalive === true) {
        try {
          return await patchWorkspaceDraftSnapshot<T>(workspaceId, namespace, draftKey, payload, {
            keepalive: true,
          });
        } catch {
          return payload;
        }
      }

      pushAbortController?.abort();
      pushAbortController = new AbortController();
      const signal = pushAbortController.signal;
      try {
        return await patchWorkspaceDraftSnapshot<T>(workspaceId, namespace, draftKey, payload, {
          signal,
        });
      } catch (error: unknown) {
        if (isAbortError(error)) {
          throw new Error(WORKSPACE_DRAFT_PATCH_ABORTED);
        }
        throw error;
      }
    },
    onDelete: async () => {
      await deleteWorkspaceDraftSnapshot(workspaceId, namespace, draftKey);
    },
  };
}
