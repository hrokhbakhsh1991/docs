import type { WorkspaceDraftSyncPayload } from "./workspace-drafts.types";

export class WorkspaceDraftVersionConflictError extends Error {
  readonly code = "DRAFT_VERSION_CONFLICT" as const;
  readonly serverPayload: WorkspaceDraftSyncPayload;

  constructor(serverPayload: WorkspaceDraftSyncPayload) {
    super("DRAFT_VERSION_CONFLICT");
    this.name = "WorkspaceDraftVersionConflictError";
    this.serverPayload = serverPayload;
  }
}

export function isWorkspaceDraftVersionConflictError(
  error: unknown
): error is WorkspaceDraftVersionConflictError {
  return error instanceof WorkspaceDraftVersionConflictError;
}
