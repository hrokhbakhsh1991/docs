import type { CanonicalDocument } from "@app-tour/workspace-sdk";

export type TourRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly canonical: CanonicalDocument;
  readonly createdAt: string;
};

export type TourWhere = {
  readonly tenantId: string;
  readonly id?: string;
};
