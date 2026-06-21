import type { DraftEngineConfig, DraftPushOptions } from "@app-tour/draft-engine";

import {
  deleteWorkspaceDraftSnapshotVerified,
  fetchWorkspaceDraftSnapshot,
  patchWorkspaceDraftSnapshot,
  WORKSPACE_DRAFT_PATCH_ABORTED,
} from "./workspace-draft-client";
import type { WorkspaceDraftAdapterOptions } from "./workspace-draft-types";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function stablePayloadJson<T>(payload: { readonly data: T }): string {
  return JSON.stringify(payload.data);
}

export function createWorkspaceDraftAdapter<T>(
  options: WorkspaceDraftAdapterOptions<T>
): DraftEngineConfig<T> {
  const workspaceId = options.workspaceId.trim();
  const namespace = options.namespace.trim();
  const draftKey = options.draftKey.trim();
  let pushAbortController: AbortController | null = null;
  let inFlightPayloadJson: string | null = null;

  return {
    id: options.id ?? `${namespace}:${draftKey}:${workspaceId}`,
    conflictStrategy: options.conflictStrategy ?? "REFETCH_REAPPLY",
    debounceMs: options.debounceMs ?? 500,
    ...(options.autoApply !== undefined ? { autoApply: options.autoApply } : {}),
    ...(options.merge !== undefined ? { merge: options.merge } : {}),
    ...(options.onPushSuccess !== undefined ? { onPushSuccess: options.onPushSuccess } : {}),
    ...(options.schemaGate !== undefined ? { schemaGate: options.schemaGate } : {}),
    ...(options.normalizeRemote !== undefined ? { normalizeRemote: options.normalizeRemote } : {}),
    ...(options.shouldBypassServerVersionAdoption !== undefined
      ? { shouldBypassServerVersionAdoption: options.shouldBypassServerVersionAdoption }
      : {}),
    onDiagnostic:
      process.env.NODE_ENV === "development"
        ? (event) => {
            console.debug("[draft-sync]", options.id ?? `${namespace}:${draftKey}`, event);
          }
        : undefined,
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

      const payloadJson = stablePayloadJson(payload);
      if (inFlightPayloadJson !== null && inFlightPayloadJson !== payloadJson) {
        pushAbortController?.abort();
        pushAbortController = new AbortController();
      } else if (pushAbortController === null) {
        pushAbortController = new AbortController();
      }
      inFlightPayloadJson = payloadJson;
      const signal = pushAbortController.signal;
      try {
        const result = await patchWorkspaceDraftSnapshot<T>(workspaceId, namespace, draftKey, payload, {
          signal,
          intentId: pushOptions?.intentId,
        });
        if (pushAbortController.signal === signal) {
          inFlightPayloadJson = null;
        }
        return result;
      } catch (error: unknown) {
        if (pushAbortController.signal === signal) {
          inFlightPayloadJson = null;
        }
        if (isAbortError(error)) {
          throw new Error(WORKSPACE_DRAFT_PATCH_ABORTED);
        }
        throw error;
      }
    },
    onDelete: async () => {
      await deleteWorkspaceDraftSnapshotVerified(workspaceId, namespace, draftKey);
    },
    onAbortInFlightPush: () => {
      pushAbortController?.abort();
      inFlightPayloadJson = null;
    },
  };
}
