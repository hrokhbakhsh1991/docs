import type {
  WorkspaceTourListPageResult,
  WorkspaceTourRecord,
  WorkspaceTourStorePort,
} from "@app-tour/workspace-sdk";

export type UrbanTourCanonical = {
  readonly data: Record<string, unknown>;
};

export type UrbanTourRecord = WorkspaceTourRecord<UrbanTourCanonical>;
export type UrbanTourListPageResult = WorkspaceTourListPageResult<UrbanTourCanonical>;

/** Host-injected tour read port — Prisma adapter lives in apps/api. */
export type UrbanTourStorePort = WorkspaceTourStorePort<UrbanTourCanonical>;
