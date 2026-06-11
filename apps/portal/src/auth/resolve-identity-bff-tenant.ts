import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

import { buildIdentityBffHeadersForTenant } from "./identity-bff-headers";

export async function resolveIdentityBffTenantId(host: string): Promise<string> {
  const bootstrap = await resolvePortalBootstrapForHost(host);
  return bootstrap.tenantId;
}

export { buildIdentityBffHeadersForTenant };

export async function buildIdentityBffHeadersAsync(req: Request): Promise<Record<string, string>> {
  const host = req.headers.get("host") ?? "localhost:3003";
  const tenantId = await resolveIdentityBffTenantId(host);
  return buildIdentityBffHeadersForTenant(host, tenantId);
}
