import type { Metadata } from "next";

import { resolveMarketingPublicBaseUrl } from "@app-tour/guest-surface-host";
import { resolveGuestSeoForPlugin, type WorkspaceGuestSeoMarketing } from "@app-tour/workspace-sdk";

import type { MarketingCatalogCard } from "@/catalog/catalog-types";
import { formatCatalogCardDescription, formatCatalogCardSubtitle } from "@/catalog/format-catalog-display";
import { resolveMarketingCatalogPhotoUrl } from "@/home/resolve-home-tour-cover-url";
import { resolveMarketingLocalePath, type AppLocale } from "@/i18n/routing";

/** Standard OG image dimensions declared for social crawlers (MKT-32). */
export const MARKETING_OG_IMAGE_WIDTH = 1200;
export const MARKETING_OG_IMAGE_HEIGHT = 630;

type MarketingTwitterMetadataInput = {
  readonly title: string;
  readonly description?: string;
  readonly imageUrl?: string | null;
};

function buildMarketingLanguageAlternates(input: {
  readonly host: string;
  readonly path: string;
}): NonNullable<Metadata["alternates"]>["languages"] {
  const origin = resolveMarketingPublicOrigin(input.host);
  return {
    "fa-IR": `${origin}${resolveMarketingLocalePath(input.path, "fa")}`,
    "en-US": `${origin}${resolveMarketingLocalePath(input.path, "en")}`,
    "x-default": `${origin}${resolveMarketingLocalePath(input.path, "fa")}`,
  };
}

function buildMarketingTwitterMetadata(
  input: MarketingTwitterMetadataInput,
  guestSeo?: WorkspaceGuestSeoMarketing
): NonNullable<Metadata["twitter"]> {
  const imageUrl = input.imageUrl?.trim();
  const hasImage = imageUrl !== undefined && imageUrl.length > 0;
  const configuredCard = guestSeo?.openGraph?.twitterCard;
  const card =
    configuredCard ?? (hasImage ? "summary_large_image" : "summary");
  const twitter: NonNullable<Metadata["twitter"]> = {
    card,
    title: input.title,
  };
  if (input.description !== undefined && input.description.length > 0) {
    twitter.description = input.description;
  }
  if (hasImage && imageUrl !== undefined) {
    twitter.images = [imageUrl];
  }
  return twitter;
}

/** Absolute marketing origin for canonical/OG URLs (WRS — normalized club apex, no shop. egress). */
export function resolveMarketingPublicOrigin(host: string): string {
  return resolveMarketingPublicBaseUrl(host);
}

export function buildMarketingSiteMetadata(input: {
  readonly host: string;
  readonly siteName: string;
  readonly toursLabel: string;
  readonly locale?: AppLocale;
}): Metadata {
  const path = "/";
  return {
    metadataBase: new URL(resolveMarketingPublicOrigin(input.host)),
    title: {
      default: `${input.siteName} — ${input.toursLabel}`,
      template: `%s — ${input.siteName}`,
    },
    openGraph: {
      type: "website",
      siteName: input.siteName,
      locale: resolveMarketingOpenGraphLocale(input.locale ?? "fa"),
    },
    alternates: {
      canonical: resolveMarketingLocalePath(path, input.locale ?? "fa"),
      languages: buildMarketingLanguageAlternates({ host: input.host, path }),
    },
  };
}

/** Whether list metadata should noindex based on guest SEO pagination policy. */
export function shouldNoindexMarketingListPage(
  searchParams: Readonly<Record<string, string | undefined>>,
  noindexQueryParams: readonly string[] | undefined
): boolean {
  if (noindexQueryParams === undefined || noindexQueryParams.length === 0) {
    return false;
  }

  for (const param of noindexQueryParams) {
    const value = searchParams[param]?.trim();
    if (value !== undefined && value.length > 0) {
      return true;
    }
  }

  return false;
}

export function buildMarketingToursListMetadata(input: {
  readonly host: string;
  readonly siteName: string;
  readonly title: string;
  readonly description: string;
  readonly locale?: AppLocale;
  readonly robots?: Metadata["robots"];
}): Metadata {
  const path = "/tours";
  const localizedPath = resolveMarketingLocalePath(path, input.locale ?? "fa");
  const url = `${resolveMarketingPublicOrigin(input.host)}${localizedPath}`;
  const socialTitle = `${input.title} — ${input.siteName}`;

  return {
    title: input.title,
    description: input.description,
    ...(input.robots !== undefined ? { robots: input.robots } : {}),
    alternates: {
      canonical: localizedPath,
      languages: buildMarketingLanguageAlternates({ host: input.host, path }),
    },
    openGraph: {
      title: socialTitle,
      description: input.description,
      url,
      type: "website",
      locale: resolveMarketingOpenGraphLocale(input.locale ?? "fa"),
    },
    twitter: buildMarketingTwitterMetadata({
      title: socialTitle,
      description: input.description,
    }),
  };
}

export function buildMarketingTourDetailMetadata(input: {
  readonly host: string;
  readonly siteName: string;
  readonly tour: MarketingCatalogCard;
  readonly tourId: string;
  readonly defaultTourTitle: string;
  readonly pluginId: string;
  readonly locale?: AppLocale;
}): Metadata {
  const guestSeo = resolveGuestSeoForPlugin(input.pluginId).marketing;
  const tourTitle = input.tour.title?.trim() || input.defaultTourTitle;
  const title = tourTitle;
  const description =
    formatCatalogCardDescription(input.tour) ||
    `${tourTitle} — ${formatCatalogCardSubtitle(input.tour)}`.trim();
  const path = `/tours/${encodeURIComponent(input.tourId.trim())}`;
  const localizedPath = resolveMarketingLocalePath(path, input.locale ?? "fa");
  const url = `${resolveMarketingPublicOrigin(input.host)}${localizedPath}`;

  const metadata: Metadata = {
    title,
    description,
    alternates: {
      canonical: localizedPath,
      languages: buildMarketingLanguageAlternates({ host: input.host, path }),
    },
    openGraph: {
      title: `${tourTitle} — ${input.siteName}`,
      description,
      url,
      type: "website",
      locale: resolveMarketingOpenGraphLocale(input.locale ?? "fa"),
    },
  };

  const cover = resolveMarketingCatalogPhotoUrl(input.tour.coverImageUrl);
  if (cover != null && cover.length > 0) {
    metadata.openGraph = {
      ...metadata.openGraph,
      images: [
        {
          url: cover,
          alt: tourTitle,
          width: MARKETING_OG_IMAGE_WIDTH,
          height: MARKETING_OG_IMAGE_HEIGHT,
        },
      ],
    };
  }

  metadata.twitter = buildMarketingTwitterMetadata(
    {
      title: `${tourTitle} — ${input.siteName}`,
      description,
      imageUrl: cover,
    },
    guestSeo
  );

  return metadata;
}

function resolveMarketingOpenGraphLocale(locale: AppLocale): string {
  return locale === "en" ? "en_US" : "fa_IR";
}

export function buildMarketingSurfaceNoindexMetadata(input: {
  readonly title: string;
  readonly description?: string;
}): Metadata {
  return {
    title: input.title,
    ...(input.description !== undefined ? { description: input.description } : {}),
    robots: { index: false, follow: false },
  };
}

export function buildMarketingNotFoundMetadata(input: {
  readonly title: string;
  readonly description: string;
}): Metadata {
  return buildMarketingSurfaceNoindexMetadata({
    title: input.title,
    description: input.description,
  });
}
