import type {
  CanonicalDocument,
  WorkspaceTourListPageResult,
  WorkspaceTourRecord,
  WorkspaceTourStorePort,
} from "@app-tour/workspace-sdk";

export type DenaliTourRecord = WorkspaceTourRecord<CanonicalDocument>;
export type DenaliTourListPageResult = WorkspaceTourListPageResult<CanonicalDocument>;

/** Host-injected tour read port — Prisma adapter lives in apps/api. */
export type DenaliTourStorePort = WorkspaceTourStorePort<CanonicalDocument>;
