import type { DraftEngineConfig } from "@app-tour/draft-engine";

import {
  deleteWorkspaceDraftSnapshot,
  fetchWorkspaceDraftSnapshot,
  patchWorkspaceDraftSnapshot,
} from "./workspace-draft-client";
import type { WorkspaceDraftAdapterOptions } from "./workspace-draft-types";

export function createWorkspaceDraftAdapter<T>(
  options: WorkspaceDraftAdapterOptions<T>
): DraftEngineConfig<T> {
  const workspaceId = options.workspaceId.trim();
  const namespace = options.namespace.trim();
  const draftKey = options.draftKey.trim();

  return {
    id: options.id ?? `${namespace}:${draftKey}:${workspaceId}`,
    conflictStrategy: options.conflictStrategy ?? "REFETCH_REAPPLY",
    debounceMs: options.debounceMs ?? 500,
    ...(options.autoApply !== undefined ? { autoApply: options.autoApply } : {}),
    ...(options.merge !== undefined ? { merge: options.merge } : {}),
    onFetch: async () => fetchWorkspaceDraftSnapshot<T>(workspaceId, namespace, draftKey),
    onPush: async (payload) =>
      patchWorkspaceDraftSnapshot<T>(workspaceId, namespace, draftKey, payload),
    onDelete: async () => {
      await deleteWorkspaceDraftSnapshot(workspaceId, namespace, draftKey);
    },
  };
}
