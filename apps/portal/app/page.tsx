import { redirect } from "next/navigation";

import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import { resolveMarketingPublicBaseUrl } from "@/marketing/resolve-marketing-public-url";
import { readPortalIngressHost } from "@/tenant/read-portal-ingress-host.server";

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const session = await readPublicCatalogSessionFromCookies();
  if (session !== null) {
    redirect("/me/registrations");
  }

  const host = await readPortalIngressHost();
  redirect(resolveMarketingPublicBaseUrl(host));
}
