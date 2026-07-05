import { redirect } from "next/navigation";

import { resolveMemberPortalDefaultRoutePath } from "@app-tour/workspace-sdk";

import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import { resolveMarketingPublicBaseUrl } from "@/marketing/resolve-marketing-public-url";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const host = await readPortalIngressHost();
  const session = await readPublicCatalogSessionFromCookies();
  if (session !== null) {
    const bootstrap = await resolvePortalBootstrapForHost(host);
    redirect(resolveMemberPortalDefaultRoutePath(bootstrap.pluginId));
  }

  redirect(resolveMarketingPublicBaseUrl(host));
}
