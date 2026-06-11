import type { PublicCatalogSession } from "@/auth/read-public-catalog-session.server";
import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import { buildUrbanPublicTenantHeaders } from "@/urban/urban-api-base";

export function mergeCatalogRegistrationHeaders(
  tenantId: string,
  session: PublicCatalogSession | null
): Record<string, string> {
  if (session === null || session.tenantId !== tenantId) {
    return buildUrbanPublicTenantHeaders(tenantId);
  }

  return {
    ...buildUrbanPublicTenantHeaders(tenantId),
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": session.userId,
    "x-actor-role": session.role,
    "x-membership-status": "ACTIVE",
  };
}

/** Guest catalog headers, upgraded with M17 session user when tenant matches. */
export async function buildCatalogRegistrationHeaders(
  tenantId: string
): Promise<Record<string, string>> {
  const session = await readPublicCatalogSessionFromCookies();
  return mergeCatalogRegistrationHeaders(tenantId, session);
}
