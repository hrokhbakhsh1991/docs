import type { Metadata } from "next";

import type { MarketingCatalogCard } from "@/catalog/catalog-types";
import { formatCatalogCardDescription, formatCatalogCardSubtitle } from "@/catalog/format-catalog-display";

/** Absolute marketing origin for canonical/OG URLs. */
export function resolveMarketingPublicOrigin(host: string): string {
  const configured = process.env.MARKETING_PUBLIC_BASE_URL?.trim();
  if (configured !== undefined && configured.length > 0) {
    return configured.replace(/\/$/, "");
  }

  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "localhost";
  const port = host.split(":")[1]?.trim() || process.env.MARKETING_DEV_PORT?.trim() || "3002";
  return `http://${hostname}:${port}`;
}

export function buildMarketingSiteMetadata(input: {
  readonly host: string;
  readonly siteName: string;
  readonly toursLabel: string;
}): Metadata {
  return {
    metadataBase: new URL(resolveMarketingPublicOrigin(input.host)),
    title: {
      default: `${input.siteName} — ${input.toursLabel}`,
      template: `%s — ${input.siteName}`,
    },
    openGraph: {
      type: "website",
      siteName: input.siteName,
    },
  };
}

export function buildMarketingToursListMetadata(input: {
  readonly host: string;
  readonly siteName: string;
  readonly title: string;
  readonly description: string;
}): Metadata {
  const url = `${resolveMarketingPublicOrigin(input.host)}/tours`;

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: "/tours" },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      type: "website",
    },
  };
}

export function buildMarketingTourDetailMetadata(input: {
  readonly host: string;
  readonly siteName: string;
  readonly tour: MarketingCatalogCard;
  readonly tourId: string;
  readonly pluginId: string;
  readonly defaultTourTitle: string;
}): Metadata {
  const tourTitle = input.tour.title?.trim() || input.defaultTourTitle;
  const title = tourTitle;
  const description =
    formatCatalogCardDescription(input.tour) ||
    `${tourTitle} — ${formatCatalogCardSubtitle(input.tour, input.pluginId)}`.trim();
  const path = `/tours/${encodeURIComponent(input.tourId.trim())}`;
  const url = `${resolveMarketingPublicOrigin(input.host)}${path}`;

  const metadata: Metadata = {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${tourTitle} — ${input.siteName}`,
      description,
      url,
      type: "website",
    },
  };

  const cover = input.tour.coverImageUrl?.trim();
  if (cover !== undefined && cover.length > 0) {
    metadata.openGraph = {
      ...metadata.openGraph,
      images: [{ url: cover, alt: tourTitle }],
    };
  }

  return metadata;
}

export function buildMarketingNotFoundMetadata(input: {
  readonly title: string;
  readonly description: string;
}): Metadata {
  return {
    title: input.title,
    description: input.description,
    robots: { index: false, follow: false },
  };
}
