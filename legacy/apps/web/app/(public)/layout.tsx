import type { ReactNode } from "react";

import { TourOpsQueryProvider } from "../(app)/query-client-provider";
import { PublicSiteConfigProvider } from "@/features/public-site/context/public-site-config-context";
import { PublicSiteShell } from "@/features/public-site/components/PublicSiteShell";
import { getPublicSiteConfigFromHeaders } from "@/features/public-site/server/get-public-site-config-from-headers";

export default async function PublicSiteLayout({ children }: { children: ReactNode }) {
  const config = await getPublicSiteConfigFromHeaders();

  return (
    <PublicSiteConfigProvider config={config}>
      <TourOpsQueryProvider>
        <PublicSiteShell>{children}</PublicSiteShell>
      </TourOpsQueryProvider>
    </PublicSiteConfigProvider>
  );
}
