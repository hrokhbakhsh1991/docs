import { buildIdentityBffHeadersForTenant as buildSharedIdentityBffHeadersForTenant } from "@app-tour/session-client";

import { resolveAdminBootstrapForWebHost } from "@/tenant/resolve-admin-bootstrap.server";
import { resolveTenantIdFromDevHost } from "@/tenant/resolve-host-tenant";

import { resolveRequestHost } from "./resolve-request-host";

export const OPERATOR_BFF_TENANT_UNRESOLVED = "OPERATOR_BFF_TENANT_UNRESOLVED";

export async function resolveOperatorBffTenantId(host: string): Promise<string> {
  const devTenantId = resolveTenantIdFromDevHost(host);
  if (devTenantId !== null) {
    return devTenantId;
  }

  try {
    const bootstrap = await resolveAdminBootstrapForWebHost(host);
    return bootstrap.tenantId;
  } catch (error) {
    if (error instanceof Error && error.message.includes("ADMIN_TENANT_UNRESOLVED")) {
      throw new Error(OPERATOR_BFF_TENANT_UNRESOLVED);
    }
    throw error;
  }
}

export function buildIdentityBffHeadersForTenant(
  host: string,
  tenantId: string
): Record<string, string> {
  return buildSharedIdentityBffHeadersForTenant(host, tenantId, {
    workspaceId:
      process.env.TOUR_OPS_DEV_WORKSPACE_ID?.trim() ??
      process.env.NEXT_PUBLIC_DEV_WORKSPACE_ID?.trim(),
  });
}

/** Operator login BFF — dev host map → ASB-001 admin bootstrap (fail-closed in prod). */
export async function buildIdentityBffHeadersAsync(req: Request): Promise<Record<string, string>> {
  const host = resolveRequestHost(req);
  const tenantId = await resolveOperatorBffTenantId(host);
  return buildIdentityBffHeadersForTenant(host, tenantId);
}

/** @deprecated Prefer `buildIdentityBffHeadersAsync` for production host resolution. */
export function buildIdentityBffHeaders(req: Request): Record<string, string> {
  const host = resolveRequestHost(req);
  const tenantId =
    resolveTenantIdFromDevHost(host) ??
    process.env.TOUR_OPS_DEV_TENANT_ID?.trim() ??
    process.env.NEXT_PUBLIC_DEV_TENANT_ID?.trim() ??
    "00000000-0000-4000-8000-000000000003";
  return buildIdentityBffHeadersForTenant(host, tenantId);
}
