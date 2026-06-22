import { cookies } from "next/headers";

import { SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { mergeCatalogRegistrationHeaders } from "@/catalog/build-catalog-registration-headers.server";
import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

export async function buildMemberApiHeaders(host: string): Promise<Record<string, string>> {
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const session = await readPublicCatalogSessionFromCookies();
  const headers = mergeCatalogRegistrationHeaders(bootstrap.tenantId, session);
  if (session !== null) {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_TOKEN_COOKIE)?.value;
    if (token !== undefined && token.length > 0) {
      return { ...headers, Authorization: `Bearer ${token}` };
    }
  }
  return headers;
}
