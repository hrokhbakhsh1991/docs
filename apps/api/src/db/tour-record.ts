import type { CanonicalDocument } from "@app-tour/workspace-sdk";

export type TourRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly canonical: CanonicalDocument;
  readonly createdAt: string;
  /** Optimistic lock — CAS on PATCH (P1-6). */
  readonly rowVersion: number;
};

export type TourWhere = {
  readonly tenantId: string;
  readonly id?: string;
};

export type TourListPageInput = {
  readonly limit: number;
  readonly cursor?: string;
};

export type TourListPageResult = {
  readonly items: readonly TourRecord[];
  readonly nextCursor: string | null;
};
