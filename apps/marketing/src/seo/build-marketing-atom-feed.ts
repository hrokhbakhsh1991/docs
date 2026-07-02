import { resolveMarketingLocalePath } from "@/i18n/routing";

import type { MarketingCatalogSitemapTour } from "@/catalog/fetch-all-catalog-tour-ids";

import { resolveMarketingPublicOrigin } from "./build-marketing-metadata";

export type MarketingAtomFeedBuildInput = {
  readonly host: string;
  readonly siteName: string;
  readonly tours: readonly MarketingCatalogSitemapTour[];
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatAtomUpdatedAt(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (trimmed !== undefined && trimmed.length > 0) {
    return trimmed;
  }
  return new Date().toISOString();
}

/** Atom 1.0 feed for published catalog tours (SEO-5++ T-098). */
export function buildMarketingAtomFeed(input: MarketingAtomFeedBuildInput): string {
  const origin = resolveMarketingPublicOrigin(input.host);
  const feedId = `${origin}/feed.xml`;
  const feedTitle = `${input.siteName} — Tours`;
  const updatedAt = formatAtomUpdatedAt(
    input.tours
      .map((tour) => tour.catalogUpdatedAt)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .sort()
      .at(-1),
  );

  const entries = input.tours
    .map((tour) => {
      const tourPath = resolveMarketingLocalePath(`/tours/${encodeURIComponent(tour.tourId)}`, "fa");
      const tourUrl = `${origin}${tourPath}`;
      const entryUpdatedAt = formatAtomUpdatedAt(tour.catalogUpdatedAt);
      return [
        "  <entry>",
        `    <title>${escapeXml(tour.tourId)}</title>`,
        `    <link href="${escapeXml(tourUrl)}" />`,
        `    <id>${escapeXml(tourUrl)}</id>`,
        `    <updated>${escapeXml(entryUpdatedAt)}</updated>`,
        "  </entry>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <title>${escapeXml(feedTitle)}</title>`,
    `  <link href="${escapeXml(feedId)}" rel="self" />`,
    `  <link href="${escapeXml(`${origin}/tours`)}" />`,
    `  <id>${escapeXml(feedId)}</id>`,
    `  <updated>${escapeXml(updatedAt)}</updated>`,
    entries,
    "</feed>",
  ].join("\n");
}
