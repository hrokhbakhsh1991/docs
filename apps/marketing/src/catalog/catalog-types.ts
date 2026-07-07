import type { PublicCatalogCard } from "@app-tour/workspace-sdk";

/** Urban-only egress fields on marketing JSON (legacy + M2b). */
export type UrbanCatalogCardExtensions = {
  readonly city?: string | null;
  readonly venueName?: string | null;
  readonly catalogSummary?: string | null;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
  readonly publishedAt?: string | null;
  readonly publishStatus?: string | null;
};

/**
 * Marketing catalog card — SDK `PublicCatalogCard` + Urban extensions.
 * `title` optional for partial upstream payloads before strict validation.
 */
export type MarketingCatalogCard = Omit<PublicCatalogCard, "title"> &
  UrbanCatalogCardExtensions & {
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
