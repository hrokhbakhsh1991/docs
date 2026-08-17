import { headers } from "next/headers";
import { unstable_cache } from "next/cache";
import { getTranslations } from "next-intl/server";

import { buildMarketingSeoCacheTag } from "@/catalog/catalog-fetch-options";
import { fetchAllCatalogSitemapTours } from "@/catalog/fetch-all-catalog-tour-ids";
import { isPlatformMotherHost } from "@/platform/is-platform-mother-host";
import { buildMarketingAtomFeed } from "@/seo/build-marketing-atom-feed";
import { shouldEmitMarketingSitemap } from "@/seo/build-marketing-sitemap";
import { fetchPublicTenantBrandingForHost } from "@/tenant/fetch-public-tenant-branding";
import { resolveGuestChromeDisplayName } from "@app-tour/guest-surface-host";
import { isMarketingSurfaceEnabled } from "@/tenant/marketing-site-surfaces";
import { resolveMarketingBootstrapForHost } from "@/tenant/resolve-marketing-bootstrap";
import { resolveMarketingSiteSurfacesForHost } from "@/tenant/resolve-marketing-site-surfaces";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3002";
  const siteSurfaces = await resolveMarketingSiteSurfacesForHost(host);

  if (
    !shouldEmitMarketingSitemap({
      isMotherHost: isPlatformMotherHost(host),
      marketingEnabled: isMarketingSurfaceEnabled(siteSurfaces),
    })
  ) {
    return new Response("Not Found", { status: 404 });
  }

  const bootstrap = await resolveMarketingBootstrapForHost(host);
  const seoTag = buildMarketingSeoCacheTag(bootstrap.tenantId);
  const [branding, t, tours] = await Promise.all([
    fetchPublicTenantBrandingForHost(host),
    getTranslations("catalog"),
    unstable_cache(
      async () =>
        fetchAllCatalogSitemapTours({
          tenantId: bootstrap.tenantId,
          pluginId: bootstrap.pluginId,
        }),
      ["marketing-atom-feed", bootstrap.tenantId],
      { tags: [seoTag] },
    )(),
  ]);

  const siteName = resolveGuestChromeDisplayName(branding.displayName, t("nav.defaultSiteName"));
  const body = buildMarketingAtomFeed({ host, siteName, tours });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
