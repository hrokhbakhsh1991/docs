import { mergeCatalogRegistrationHeaders } from "@/catalog/build-catalog-registration-headers.server";
import {
  readMemberSessionToken,
  readPublicCatalogSessionFromCookies,
} from "@/auth/read-public-catalog-session.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

export async function buildMemberApiHeaders(host: string): Promise<Record<string, string>> {
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const session = await readPublicCatalogSessionFromCookies();
  const headers = mergeCatalogRegistrationHeaders(bootstrap.tenantId, session);
  if (session !== null) {
    const token = await readMemberSessionToken();
    if (token !== undefined && token.length > 0) {
      return { ...headers, Authorization: `Bearer ${token}` };
    }
  }
  return headers;
}
