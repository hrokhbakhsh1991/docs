export class TenantProvisionConflictError extends Error {
  readonly code: string;

  constructor(code: "TENANT_ID_ALREADY_EXISTS" | "TENANT_SUBDOMAIN_ALREADY_EXISTS") {
    super(code);
    this.name = "TenantProvisionConflictError";
    this.code = code;
  }
}

/** Phase H2 — production onboarding blocked for stub-tier workspace plugins. */
export class WorkspaceNotCertifiedForProductionError extends Error {
  readonly code = "WORKSPACE_NOT_CERTIFIED_FOR_PRODUCTION" as const;
  readonly workspaceType: string;
  readonly pluginId: string;

  constructor(workspaceType: string, pluginId: string) {
    super(`WORKSPACE_NOT_CERTIFIED_FOR_PRODUCTION:${workspaceType}:${pluginId}`);
    this.name = "WorkspaceNotCertifiedForProductionError";
    this.workspaceType = workspaceType;
    this.pluginId = pluginId;
  }
}
