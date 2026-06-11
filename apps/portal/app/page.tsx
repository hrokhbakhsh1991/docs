import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { resolveMarketingPublicBaseUrl } from "@/marketing/resolve-marketing-public-url";

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const host = (await headers()).get("host") ?? "localhost:3003";
  redirect(resolveMarketingPublicBaseUrl(host));
}
