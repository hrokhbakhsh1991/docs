import {
  buildTourListProjection,
  type TourListProjection,
} from "@app-tour/workspace-sdk";
import type { CanonicalDocument, TenantAuthContext } from "@app-tour/workspace-sdk";

import { enrichTourListProjectionWithAcceptedCount } from "../bookings/enrich-tour-accepted-counts";
import { enrichTourListProjectionCoverImageUrl } from "./enrich-tour-list-cover-image-url";
import type { TourRecord } from "../db/tour-record";
import { resolveTourListProjectionExtractorForWorkspace } from "./workspace-tour-list-projection-dispatch";
import type { ToursService } from "./tours.service";

export type OperatorTourDetailResponse = {
  readonly id: string;
  readonly tenantId: string;
  readonly rowVersion: number;
  readonly canonical: CanonicalDocument;
  readonly projection: TourListProjection;
};

export async function buildOperatorTourDetailResponse(
  record: TourRecord,
  tenantId: string,
  workspaceType: string
): Promise<OperatorTourDetailResponse> {
  const extract = resolveTourListProjectionExtractorForWorkspace(workspaceType);
  const baseProjection = buildTourListProjection(
    {
      id: record.id,
      tenantId: record.tenantId,
      createdAt: record.createdAt,
      updatedAt: record.createdAt,
      rowVersion: record.rowVersion,
    },
    record.canonical,
    extract
  );
  const withCover = await enrichTourListProjectionCoverImageUrl(
    baseProjection,
    record.canonical,
    tenantId,
    workspaceType
  );
  const projection = await enrichTourListProjectionWithAcceptedCount(tenantId, withCover);

  return {
    id: record.id,
    tenantId: record.tenantId,
    rowVersion: record.rowVersion,
    canonical: record.canonical,
    projection,
  };
}

export async function getTourOperator(
  toursService: ToursService,
  auth: TenantAuthContext,
  tourId: string
): Promise<OperatorTourDetailResponse | null> {
  const record = await toursService.getTourById(auth, tourId);
  if (record === null) {
    return null;
  }
  // Honor ToursService.resolveWorkspaceType (route injection / test helpers) — do not
  // re-call platform resolveWorkspaceTypeForTenant and bypass the HTTP-bound resolver.
  const workspaceType = await toursService.resolveWorkspaceType(auth.tenantId);
  return buildOperatorTourDetailResponse(record, auth.tenantId, workspaceType);
}
