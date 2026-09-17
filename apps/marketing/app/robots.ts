import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";

import { buildMarketingSeoCacheTag } from "@/catalog/catalog-fetch-options";

import { isPlatformMotherHost } from "@/platform/is-platform-mother-host";
import {
  buildMarketingRobots,
  isMarketingSearchIndexingEnabled,
  shouldEmitMarketingSitemap,
} from "@/seo/build-marketing-sitemap";
import { isMarketingSurfaceEnabled } from "@/tenant/marketing-site-surfaces";
import { isMarketingTenantUnresolvedError } from "@/tenant/resolve-marketing-bootstrap-api";
import { resolveMarketingBootstrapForHost } from "@/tenant/resolve-marketing-bootstrap";
import { resolveMarketingSiteSurfacesForHost } from "@/tenant/resolve-marketing-site-surfaces";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3002";
  const siteSurfaces = await resolveMarketingSiteSurfacesForHost(host);
  const catalogSurface = shouldEmitMarketingSitemap({
    isMotherHost: isPlatformMotherHost(host),
    marketingEnabled: isMarketingSurfaceEnabled(siteSurfaces),
  });

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

  return unstable_cache(
    async () =>
      buildMarketingRobots({
        host,
        allowIndexing: catalogSurface && isMarketingSearchIndexingEnabled(),
      }),
    ["marketing-robots", bootstrap.tenantId],
    { tags: [seoTag] }
  )();
}
