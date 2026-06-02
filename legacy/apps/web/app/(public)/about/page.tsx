import type { Metadata } from "next";

import { PageRenderer } from "@/features/content/components/PageRenderer";
import { getPublicSiteConfigFromHeaders } from "@/features/public-site/server/get-public-site-config-from-headers";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getPublicSiteConfigFromHeaders();
  const page = config.pages.about;
  return {
    title: page.route.title ?? "درباره",
    description: page.route.metaDescription,
  };
}

export default async function PublicAboutPage() {
  const config = await getPublicSiteConfigFromHeaders();
  return <PageRenderer page={config.pages.about} />;
}
