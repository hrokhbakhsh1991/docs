export const URBAN_WORKSPACE_REQUIRED = "URBAN_WORKSPACE_REQUIRED" as const;

export class UrbanWorkspaceRequiredError extends Error {
  readonly code = URBAN_WORKSPACE_REQUIRED;
  readonly httpStatus = 404 as const;

  constructor() {
    super(URBAN_WORKSPACE_REQUIRED);
    this.name = "UrbanWorkspaceRequiredError";
  }
}

export function isUrbanWorkspaceRequiredError(error: unknown): error is UrbanWorkspaceRequiredError {
  return (
    error instanceof UrbanWorkspaceRequiredError ||
    (typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === URBAN_WORKSPACE_REQUIRED)
  );
}
