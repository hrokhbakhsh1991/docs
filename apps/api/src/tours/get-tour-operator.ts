import {
  buildTourListProjection,
  type TourListProjection,
  type TourListProjectionFields,
} from "@app-tour/workspace-sdk";
import type { CanonicalDocument, TenantAuthContext } from "@app-tour/workspace-sdk";

import { enrichTourListProjectionWithAcceptedCount } from "../bookings/enrich-tour-accepted-counts";
import { enrichTourListProjectionCoverImageUrl } from "./enrich-tour-list-cover-image-url";
import type { TourRecord } from "../db/tour-record";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";
import type { ToursService } from "./tours.service";

export type OperatorTourDetailResponse = {
  readonly id: string;
  readonly tenantId: string;
  readonly rowVersion: number;
  readonly canonical: CanonicalDocument;
  readonly projection: TourListProjection;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function readStarterTitle(canonical: CanonicalDocument): string {
  const data = canonical.data;
  if (!isRecord(data)) {
    return "Untitled tour";
  }
  const basics = data.basics;
  if (isRecord(basics) && typeof basics.title === "string" && basics.title.trim().length > 0) {
    return basics.title.trim();
  }
  if (typeof data.title === "string" && data.title.trim().length > 0) {
    return data.title.trim();
  }
  return "Untitled tour";
}

function defaultExtractTourListProjection(canonical: CanonicalDocument): TourListProjectionFields {
  return Object.freeze({
    title: readStarterTitle(canonical),
    shortDescription: null,
    listStatus: "draft",
    uiStatus: "draft",
    priceAmount: null,
    priceCurrency: null,
    totalCapacity: null,
    acceptedCount: 0,
    category: null,
    coverImageUrl: null,
    coverImageStorageKey: null,
    departureAt: null,
  });
}

export async function buildOperatorTourDetailResponse(
  record: TourRecord,
  tenantId: string
): Promise<OperatorTourDetailResponse> {
  const workspaceType = await resolveWorkspaceTypeForTenant(tenantId);
  const plugin = await resolveWorkspacePluginForType(workspaceType);
  const extract =
    plugin.tourList?.extractTourListProjection ?? defaultExtractTourListProjection;
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
  return buildOperatorTourDetailResponse(record, auth.tenantId);
}
