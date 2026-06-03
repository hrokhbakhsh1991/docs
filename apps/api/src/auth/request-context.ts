import { parseTenantAuthContext, type TenantAuthContext } from "@app-tour/workspace-sdk";

import { UNAUTHORIZED_MISSING_AUTHENTICATED_TENANT } from "../tenant-kernel/auth-errors";

export type RequestAuthHeaders = {
  /** Tenant claim on the request (may be spoofed — must match authenticatedTenantId when both set). */
  readonly tenantId?: string;
  /** Trusted tenant from session/token (P3-E-DB-01 auth binding). */
  readonly authenticatedTenantId?: string;
  readonly userId?: string;
  readonly role?: string;
  readonly status?: string;
  readonly workspaceId?: string;
};

export function resolveAuthenticatedTenantId(headers: RequestAuthHeaders): string {
  const trusted = headers.authenticatedTenantId?.trim() ?? "";
  const claimed = headers.tenantId?.trim() ?? "";
  if (trusted.length === 0) {
    throw new Error(UNAUTHORIZED_MISSING_AUTHENTICATED_TENANT);
  }
  if (claimed.length > 0 && trusted !== claimed) {
    throw new Error("FORBIDDEN_TENANT_CLAIM_MISMATCH");
  }
  return trusted;
}

/** Builds tenant context from validated headers (caller must assert required fields first). */
export function parseRequestAuth(headers: RequestAuthHeaders): TenantAuthContext {
  return parseTenantAuthContext({
    userId: headers.userId!,
    tenantId: resolveAuthenticatedTenantId(headers),
    role: headers.role as TenantAuthContext["role"],
    status: headers.status as TenantAuthContext["status"],
    workspaceId: headers.workspaceId!,
  });
}
