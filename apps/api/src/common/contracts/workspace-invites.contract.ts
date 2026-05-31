export const TENANT_MANAGEMENT_DB_PORT = Symbol("TENANT_MANAGEMENT_DB_PORT");
export const TENANT_AUDIT_EVENTS_PORT = Symbol("TENANT_AUDIT_EVENTS_PORT");

export interface TenantManagementDbPort {
  listUserWorkspacesForAuth(_userId: string): Promise<
    Array<{
      tenant_id: string;
      tenant_name: string;
      tenant_subdomain: string;
      role: string;
      session_version: number;
    }>
  >;
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
