import type { PublicCatalogCard } from "@app-tour/workspace-sdk";

/** Optional presentation egress fields on marketing JSON across workspace adapters. */
export type MarketingCatalogPresentationExtensions = {
  readonly city?: string | null;
  readonly venueName?: string | null;
  readonly catalogSummary?: string | null;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
  readonly publishedAt?: string | null;
  readonly publishStatus?: string | null;
};

/**
 * Marketing catalog card — SDK `PublicCatalogCard` + presentation extensions.
 * `title` optional for partial upstream payloads before strict validation.
 */
export type MarketingCatalogCard = Omit<PublicCatalogCard, "title"> &
  MarketingCatalogPresentationExtensions & {
    readonly title?: string | null;
  };

export type MarketingCatalogListResponse = {
  readonly success: boolean;
  readonly data?: { readonly items: readonly MarketingCatalogCard[] };
  readonly metadata?: { readonly nextCursor: string | null };
};

export type MarketingCatalogListResult = {
  readonly items: readonly MarketingCatalogCard[];
  readonly nextCursor: string | null;
};
