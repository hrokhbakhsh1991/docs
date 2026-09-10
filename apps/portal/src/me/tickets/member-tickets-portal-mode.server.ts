import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";

export async function resolveMemberTicketsPortalReadOnly(tenantId: string): Promise<boolean> {
  const session = await readPublicCatalogSessionFromCookies();
  return session !== null && session.tenantId === tenantId && session.role === "viewer";
}
