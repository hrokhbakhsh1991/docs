export class DenaliWorkspaceRequiredError extends Error {
  readonly code = "DENALI_WORKSPACE_REQUIRED" as const;

  constructor() {
    super("DENALI_WORKSPACE_REQUIRED");
    this.name = "DenaliWorkspaceRequiredError";
  }
}
