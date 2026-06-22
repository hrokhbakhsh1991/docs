import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { readPublicCatalogSessionFromCookies } from "@/auth/read-public-catalog-session.server";
import { resolveMarketingPublicBaseUrl } from "@/marketing/resolve-marketing-public-url";

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const session = await readPublicCatalogSessionFromCookies();
  if (session !== null) {
    redirect("/me/registrations");
  }

  const host = (await headers()).get("host") ?? "localhost:3003";
  redirect(resolveMarketingPublicBaseUrl(host));
}
