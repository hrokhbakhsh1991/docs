import { headers } from "next/headers";

import { resolvePublicSiteConfig } from "@/features/public-site/config/resolve-public-site-config";
import type { PublicSiteConfig } from "@/features/public-site/config/resolve-public-site-config";
import { evaluateWorkspaceHost } from "@/lib/tenant/workspace-host-policy";

/** Resolves {@link PublicSiteConfig} from the inbound request Host (server components / layouts). */
export async function getPublicSiteConfigFromHeaders(): Promise<PublicSiteConfig> {
  const headerBag = await headers();
  const host = headerBag.get("host");
  const evaluated = evaluateWorkspaceHost(host);
  const slug = evaluated.ok ? evaluated.slug : "general";
  return resolvePublicSiteConfig(slug);
}
