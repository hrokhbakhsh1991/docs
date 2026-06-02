import type { Metadata } from "next";

import { PublicCatalogGrid } from "@/features/public-site/components/PublicCatalogGrid";
import { getPublicSiteConfigFromHeaders } from "@/features/public-site/server/get-public-site-config-from-headers";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getPublicSiteConfigFromHeaders();
  return {
    title: "تورها",
    description: `فهرست تورهای باز — ${config.contentWorkspace}`,
  };
}

export default function PublicCatalogPage() {
  return <PublicCatalogGrid />;
}
