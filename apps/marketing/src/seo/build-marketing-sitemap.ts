import type { MetadataRoute } from "next";

import { resolveMarketingCatalogPhotoUrl } from "@/home/resolve-home-tour-cover-url";
import { resolveMarketingLocalePath } from "@/i18n/routing";

import { resolveMarketingPublicOrigin } from "./build-marketing-metadata";

export type MarketingSitemapTourEntry = {
  readonly tourId: string;
  readonly catalogUpdatedAt?: string | null;
  readonly coverImageUrl?: string | null;
};

export type MarketingSitemapBuildInput = {
  readonly host: string;
  readonly tours: readonly MarketingSitemapTourEntry[];
  readonly includeHome?: boolean;
  readonly sitemapPolicy?: {
    readonly changefreq?: MetadataRoute.Sitemap[number]["changeFrequency"];
    readonly priority?: number;
  };
};

/** Whether this host should emit catalog URLs in sitemap (club tenants only). */
export function shouldEmitMarketingSitemap(input: {
  readonly isMotherHost: boolean;
  readonly marketingEnabled: boolean;
}): boolean {
  return !input.isMotherHost && input.marketingEnabled;
}

export function buildMarketingSitemapEntries(
  input: MarketingSitemapBuildInput
): MetadataRoute.Sitemap {
  const origin = resolveMarketingPublicOrigin(input.host);
  const tourChangeFrequency = input.sitemapPolicy?.changefreq ?? "weekly";
  const tourPriority = input.sitemapPolicy?.priority ?? 0.8;
  const languageAlternates = (path: string) => ({
    languages: {
      "fa-IR": `${origin}${resolveMarketingLocalePath(path, "fa")}`,
      "en-US": `${origin}${resolveMarketingLocalePath(path, "en")}`,
      "x-default": `${origin}${resolveMarketingLocalePath(path, "fa")}`,
    },
  });
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${origin}/tours`,
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: languageAlternates("/tours"),
    },
  ];

  if (input.includeHome === true) {
    entries.unshift({
      url: `${origin}/`,
      changeFrequency: "weekly",
      priority: 1,
      alternates: languageAlternates("/"),
    });
  }

  for (const tour of input.tours) {
    const tourId = tour.tourId.trim();
    if (tourId.length === 0) {
      continue;
    }
    const lastModified = tour.catalogUpdatedAt?.trim();
    const coverImageUrl = resolveMarketingCatalogPhotoUrl(tour.coverImageUrl);
    entries.push({
      url: `${origin}/tours/${encodeURIComponent(tourId)}`,
      changeFrequency: tourChangeFrequency,
      priority: tourPriority,
      alternates: languageAlternates(`/tours/${encodeURIComponent(tourId)}`),
      ...(lastModified !== undefined && lastModified.length > 0
        ? { lastModified: new Date(lastModified) }
        : {}),
      ...(coverImageUrl != null ? { images: [coverImageUrl] } : {}),
    });
  }

  return entries;
}

/** True when crawlers may index marketing catalog URLs (production by default). */
export function isMarketingSearchIndexingEnabled(): boolean {
  const override = process.env.MARKETING_ROBOTS_ALLOW_INDEX?.trim().toLowerCase();
  if (override === "true" || override === "1") {
    return true;
  }
  if (override === "false" || override === "0") {
    return false;
  }
  return process.env.NODE_ENV === "production";
}

export type MarketingRobotsBuildInput = {
  readonly host: string;
  readonly allowIndexing: boolean;
};

export function buildMarketingRobots(input: MarketingRobotsBuildInput): MetadataRoute.Robots {
  const origin = resolveMarketingPublicOrigin(input.host);

  if (!input.allowIndexing) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
