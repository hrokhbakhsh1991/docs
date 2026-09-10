import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";

import { resolveGuestSeoForPlugin } from "@app-tour/workspace-sdk";

import { buildMarketingSeoCacheTag } from "@/catalog/catalog-fetch-options";
import { fetchAllCatalogSitemapTours } from "@/catalog/fetch-all-catalog-tour-ids";
import { isPlatformMotherHost } from "@/platform/is-platform-mother-host";
import {
  buildMarketingSitemapEntries,
  shouldEmitMarketingSitemap,
} from "@/seo/build-marketing-sitemap";
import { isMarketingSurfaceEnabled } from "@/tenant/marketing-site-surfaces";
import { isMarketingTenantUnresolvedError } from "@/tenant/resolve-marketing-bootstrap-api";
import { resolveMarketingBootstrapForHost } from "@/tenant/resolve-marketing-bootstrap";
import { resolveMarketingSiteSurfacesForHost } from "@/tenant/resolve-marketing-site-surfaces";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3002";
  const siteSurfaces = await resolveMarketingSiteSurfacesForHost(host);

  if (
    !shouldEmitMarketingSitemap({
      isMotherHost: isPlatformMotherHost(host),
      marketingEnabled: isMarketingSurfaceEnabled(siteSurfaces),
    })
  ) {
    return [];
  }

  const bootstrap = await resolveMarketingBootstrapForHost(host).catch((error: unknown) => {
    if (isMarketingTenantUnresolvedError(error)) {
      return null;
    }
    throw error;
  });
  if (bootstrap === null) {
    notFound();
  }
  const seoTag = buildMarketingSeoCacheTag(bootstrap.tenantId);
  const guestSeo = resolveGuestSeoForPlugin(bootstrap.pluginId).marketing;

  return unstable_cache(
    async () => {
      const tours = await fetchAllCatalogSitemapTours({
        tenantId: bootstrap.tenantId,
        pluginId: bootstrap.pluginId,
      });

      return buildMarketingSitemapEntries({
        host,
        tours,
        includeHome: true,
        sitemapPolicy: guestSeo.sitemap,
      });
    },
    ["marketing-sitemap", bootstrap.tenantId],
    { tags: [seoTag] }
  )();
}
