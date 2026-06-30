import { deleteWorkspaceDraftSnapshot } from "@/draft/workspace-draft-client";

export type CreateTourPostSubmitDiscardInput = {
  readonly workspaceId: string;
  readonly namespace: string;
  readonly draftKey: string;
};

/** Shared fire-and-forget remote draft DELETE for wizard post-submit success. */
export function createCreateTourPostSubmitDiscardRemoteDraft(
  input: CreateTourPostSubmitDiscardInput
): () => Promise<void> {
  return () => deleteWorkspaceDraftSnapshot(input.workspaceId, input.namespace, input.draftKey);
}
