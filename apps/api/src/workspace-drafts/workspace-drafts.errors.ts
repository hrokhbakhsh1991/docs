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

export class WorkspaceDraftTombstoneInvariantError extends Error {
  readonly code: "TOMBSTONE_RESURRECTION" | "DELETED_ROOTS_NOT_ARRAY";
  readonly keys?: readonly string[];

  constructor(code: "TOMBSTONE_RESURRECTION" | "DELETED_ROOTS_NOT_ARRAY", keys?: readonly string[]) {
    super(code);
    this.name = "WorkspaceDraftTombstoneInvariantError";
    this.code = code;
    this.keys = keys;
  }
}
