import { isJwtVerifyConfigured, validateSessionTokenAsync } from "@app-tour/session-client";

import { readMemberSessionTokenFromRequest } from "@/auth/read-member-session-token-from-request.server";
import { mergeCatalogRegistrationHeaders } from "@/catalog/build-catalog-registration-headers.server";
import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

export async function buildMemberApiHeaders(host: string): Promise<Record<string, string>> {
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const session = await readPublicCatalogSessionFromCookies();
  const headers = mergeCatalogRegistrationHeaders(bootstrap.tenantId, session);
  if (session !== null) {
    const token = await readMemberSessionTokenFromRequest();
    if (token !== undefined && token.length > 0) {
      // Fail closed: only forward member bearer tokens when portal can verify
      // the same JWT contract that API enforces.
      if (!isJwtVerifyConfigured()) {
        return headers;
      }
      const validation = await validateSessionTokenAsync(token);
      if (validation.status === "valid") {
        return { ...headers, Authorization: `Bearer ${token}` };
      }
    }
  }
  return headers;
}
