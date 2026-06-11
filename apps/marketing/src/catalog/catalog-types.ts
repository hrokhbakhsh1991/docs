/** Egress-safe card — workspace APIs extend fields beyond a shared minimum. */
export type MarketingCatalogCard = {
  readonly id: string;
  readonly title?: string | null;
  readonly shortDescription?: string | null;
  readonly category?: string | null;
  readonly departureAt?: string | null;
  readonly endAt?: string | null;
  readonly priceAmount?: number | null;
  readonly priceCurrency?: string;
  readonly coverImageUrl?: string | null;
  readonly totalCapacity?: number | null;
  readonly spotsRemaining?: number | null;
  readonly difficultyLevel?: number | null;
  readonly fitnessLevel?: string | null;
  readonly city?: string | null;
  readonly venueName?: string | null;
  readonly catalogSummary?: string | null;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
  readonly publishedAt?: string | null;
  readonly publishStatus?: string | null;
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
