export class WorkspaceDraftForbiddenError extends Error {
  readonly code = "WORKSPACE_DRAFT_FORBIDDEN" as const;

  constructor() {
    super("WORKSPACE_DRAFT_FORBIDDEN");
    this.name = "WorkspaceDraftForbiddenError";
  }
}

export class WorkspaceDraftNotFoundError extends Error {
  readonly code = "WORKSPACE_DRAFT_NOT_FOUND" as const;

  constructor() {
    super("WORKSPACE_DRAFT_NOT_FOUND");
    this.name = "WorkspaceDraftNotFoundError";
  }
}

export class WorkspaceDraftInvalidBodyError extends Error {
  readonly code = "WORKSPACE_DRAFT_INVALID_BODY" as const;

  constructor() {
    super("WORKSPACE_DRAFT_INVALID_BODY");
    this.name = "WorkspaceDraftInvalidBodyError";
  }
}
