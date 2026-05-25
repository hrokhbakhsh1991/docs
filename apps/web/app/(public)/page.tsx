import type { Metadata } from "next";

import { PageRenderer } from "@/features/content/components/PageRenderer";
import { getPublicSiteConfigFromHeaders } from "@/features/public-site/server/get-public-site-config-from-headers";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getPublicSiteConfigFromHeaders();
  const page = config.pages.landing;
  return {
    title: page.route.title ?? page.sections[0]?.title ?? "خانه",
    description: page.route.metaDescription,
  };
}

/** Registry-driven landing — workspace bundle from {@link resolvePublicSiteConfig}. */
export default async function PublicLandingPage() {
  const config = await getPublicSiteConfigFromHeaders();
  return <PageRenderer page={config.pages.landing} />;
}
