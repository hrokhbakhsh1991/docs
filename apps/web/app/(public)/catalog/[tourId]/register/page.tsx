import type { Metadata } from "next";

import { PublicRegisterForm } from "@/features/registrations/components/PublicRegisterForm";
import { getPublicSiteConfigFromHeaders } from "@/features/public-site/server/get-public-site-config-from-headers";

export async function generateMetadata(): Promise<Metadata> {
  const config = await getPublicSiteConfigFromHeaders();
  return {
    title: `ثبت‌نام — ${config.programLabel}`,
  };
}

export default async function PublicTourRegisterPage({ params }: { params: { tourId: string } }) {
  const config = await getPublicSiteConfigFromHeaders();

  return (
    <PublicRegisterForm
      tourId={params.tourId}
      programLabel={config.programLabel}
      contentWorkspace={config.contentWorkspace}
      catalogListPath={config.catalog.listPath}
      catalogDetailPath={config.catalog.detailPath(params.tourId)}
    />
  );
}
