import type { TenantContext } from "@/lib/tenant/runtime-tenant-context";
import {
  buildTenantHostHeader,
  buildTenantSubdomainOrigin,
  resolveBffTenantContext,
} from "@/lib/tenant/runtime-tenant-context";

/** Nest API origin for the active workspace — sole URL source for BFF (Lock D). */
export function getApiBaseUrl(req: Request): string {
  const tenant = resolveBffTenantContext(req);
  return buildApiBaseUrlFromTenant(tenant);
}

export function buildApiBaseUrlFromTenant(tenant: TenantContext): string {
  return buildTenantSubdomainOrigin(tenant.tenantSlug);
}

export function buildBffProxyHeadersFromTenant(tenant: TenantContext): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    host: buildTenantHostHeader(tenant.tenantSlug),
  };
  if (tenant.tenantId) {
    headers["x-tenant-id"] = tenant.tenantId;
  }
  return headers;
}

export function tenantBffProxyHeaders(req: Request): HeadersInit {
  return buildBffProxyHeadersFromTenant(resolveBffTenantContext(req));
}
