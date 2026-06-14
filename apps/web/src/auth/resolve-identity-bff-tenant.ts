import { resolvePublicCatalogBootstrapForHost } from "@/tenant/resolve-public-catalog-bootstrap.server";

import {
  buildIdentityBffHeadersForTenant,
} from "./identity-bff-headers";
import { resolveRequestHost } from "./resolve-request-host";

const ANONYMOUS_OTP_USER_ID = "00000000-0000-4000-8000-000000000099";

export { ANONYMOUS_OTP_USER_ID };

export async function resolveIdentityBffTenantId(host: string): Promise<string> {
  const bootstrap = await resolvePublicCatalogBootstrapForHost(host);
  return bootstrap.tenantId;
}

export { buildIdentityBffHeadersForTenant };

export async function buildIdentityBffHeadersAsync(req: Request): Promise<Record<string, string>> {
  const host = resolveRequestHost(req);
  const tenantId = await resolveIdentityBffTenantId(host);
  return buildIdentityBffHeadersForTenant(host, tenantId);
}
