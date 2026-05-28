export const TENANT_MANAGEMENT_DB_PORT = Symbol("TENANT_MANAGEMENT_DB_PORT");
export const TENANT_AUDIT_EVENTS_PORT = Symbol("TENANT_AUDIT_EVENTS_PORT");

export type AcceptWorkspaceInviteDbResult = {
  ok: boolean;
  error_code: string | null;
  out_tenant_id: string | null;
  out_role: string | null;
};

export interface TenantManagementDbPort {
  acceptWorkspaceInviteByToken(
    _token: string,
    _userId: string
  ): Promise<AcceptWorkspaceInviteDbResult>;
}

export interface TenantAuditEventsPort {
  appendOrWarn(_payload: {
    tenantId: string;
    actorUserId: string;
    actor: string;
    userId: string;
    action: string;
    resourceType: string;
    resourceId: string;
    metadata: Record<string, unknown>;
    clientIp?: string;
    requestId?: string;
  }): Promise<void>;
}
