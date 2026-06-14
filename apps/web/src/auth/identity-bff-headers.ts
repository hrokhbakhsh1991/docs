import { fetchPublicTenantContextForHost } from "@/tenant/fetch-public-tenant-context.server";
import { isDevWebSessionAllowed } from "@/tenant/auth-env";
import { resolveTenantIdFromDevHost } from "@/tenant/resolve-host-tenant";
import { resolvePublicFallbackTenantId } from "@/tenant/resolve-public-host-fallback";

import { resolveRequestHost } from "./resolve-request-host";

const ANONYMOUS_OTP_USER_ID = "00000000-0000-4000-8000-000000000099";

export const OPERATOR_BFF_TENANT_UNRESOLVED = "OPERATOR_BFF_TENANT_UNRESOLVED";

function fallbackOperatorTenantId(): string {
  return (
    process.env.TOUR_OPS_DEV_TENANT_ID?.trim() ??
    process.env.NEXT_PUBLIC_DEV_TENANT_ID?.trim() ??
    "00000000-0000-4000-8000-000000000003"
  );
}

export async function resolveOperatorBffTenantId(host: string): Promise<string> {
  const devTenantId = resolveTenantIdFromDevHost(host);
  if (devTenantId !== null) {
    return devTenantId;
  }

  const publicContext = await fetchPublicTenantContextForHost(host);
  if (publicContext !== null) {
    return publicContext.tenantId;
  }

  if (isDevWebSessionAllowed()) {
    return fallbackOperatorTenantId();
  }

  const fallbackTenantId = resolvePublicFallbackTenantId(host);
  if (fallbackTenantId !== null) {
    return fallbackTenantId;
  }

  throw new Error(OPERATOR_BFF_TENANT_UNRESOLVED);
}

export function buildIdentityBffHeadersForTenant(
  host: string,
  tenantId: string
): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": ANONYMOUS_OTP_USER_ID,
    "x-actor-role": "member",
    "x-membership-status": "ACTIVE",
    "x-workspace-id":
      process.env.TOUR_OPS_DEV_WORKSPACE_ID?.trim() ??
      process.env.NEXT_PUBLIC_DEV_WORKSPACE_ID?.trim() ??
      "ws-operator-dev",
    host: host.split(":")[0] ?? host,
  };
}

/** Operator login BFF — dev host map → tenant-context → dev env (M17.2). */
export async function buildIdentityBffHeadersAsync(req: Request): Promise<Record<string, string>> {
  const host = resolveRequestHost(req);
  const tenantId = await resolveOperatorBffTenantId(host);
  return buildIdentityBffHeadersForTenant(host, tenantId);
}

/** @deprecated Prefer `buildIdentityBffHeadersAsync` for production host resolution. */
export function buildIdentityBffHeaders(req: Request): Record<string, string> {
  const host = resolveRequestHost(req);
  const tenantId = resolveTenantIdFromDevHost(host) ?? fallbackOperatorTenantId();
  return buildIdentityBffHeadersForTenant(host, tenantId);
}
