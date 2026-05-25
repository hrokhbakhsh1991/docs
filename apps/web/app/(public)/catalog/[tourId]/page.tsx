import type { Metadata } from "next";

import { PublicTourDetailView } from "@/features/public-site/components/PublicTourDetailView";
import { getPublicSiteConfigFromHeaders } from "@/features/public-site/server/get-public-site-config-from-headers";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getPublicSiteConfigFromHeaders();
  return {
    title: `جزئیات تور — ${config.programLabel}`,
  };
}

export default function PublicTourDetailPage({ params }: { params: { tourId: string } }) {
  return <PublicTourDetailView tourId={params.tourId} />;
}
