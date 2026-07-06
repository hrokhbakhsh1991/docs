import type { PublicCatalogCard } from "@app-tour/workspace-sdk";

/** Urban HTTP egress — SDK card + M2b extension fields for marketing JSON. */
export type UrbanPublicCatalogEgress = PublicCatalogCard & {
  readonly city?: string | null;
  readonly venueName?: string | null;
  readonly catalogSummary?: string | null;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
  readonly publishedAt?: string | null;
  readonly publishStatus?: string | null;
};
