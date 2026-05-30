export const WORKSPACE_AUDIT_REPOSITORY_PORT = Symbol("WORKSPACE_AUDIT_REPOSITORY_PORT");

export interface WorkspaceAuditRepositoryPort {
  log(data: {
    workspaceId: string;
    userId: string;
    entityType: "tour" | "preset";
    entityId: string;
    action: string;
    meta?: Record<string, unknown>;
  }): Promise<void>;
}
