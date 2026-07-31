import type { CanonicalDocument, PublicCatalogTourInput } from "@app-tour/workspace-sdk";
import {
  applyWorkspaceCatalogCardExposure,
  assertWorkspaceTypeOrThrow,
  clampWorkspaceCatalogPageLimit,
  filterWorkspacePublishedTours,
  loadWorkspaceTourIfPublished,
  mapWorkspaceCatalogSliceAsync,
  sliceWorkspaceCatalogByIdCursor,
} from "@app-tour/workspace-sdk";

import { applyUrbanCatalogCardExposure } from "../catalog/urban-catalog-exposure-bindings";
import type { UrbanPublicCatalogEgress } from "../catalog/urban-public-catalog-surface";
import { toUrbanPublicCatalogCard } from "../catalog/urban-public-catalog-surface";
import {
  URBAN_EXPOSURE_SURFACE,
  resolveUrbanExposureCoordinate,
} from "../exposure/urban-exposure-surfaces";
import { URBAN_WORKSPACE_TYPE } from "../urban.plugin";
import { UrbanWorkspaceRequiredError } from "./errors/urban-workspace-required.error";
import type { UrbanExposureResolverPort } from "./ports/exposure-resolver.port";
import { isUrbanTourPublished, toUrbanCatalogCard } from "./publish-status";
import type { UrbanTourRecord, UrbanTourStorePort } from "./ports/tour-store.port";

export type UrbanCatalogListResult = {
  readonly items: readonly UrbanPublicCatalogEgress[];
  readonly nextCursor: string | null;
};

async function applyCatalogExposure(params: {
  readonly tenantId: string;
  readonly tour: PublicCatalogTourInput;
  readonly card: UrbanPublicCatalogEgress;
  readonly surface: (typeof URBAN_EXPOSURE_SURFACE)[keyof typeof URBAN_EXPOSURE_SURFACE];
  readonly exposurePort?: UrbanExposureResolverPort;
}): Promise<UrbanPublicCatalogEgress> {
  return applyWorkspaceCatalogCardExposure({
    tenantId: params.tenantId,
    tourId: params.tour.id,
    canonical: params.tour.canonical,
    card: params.card,
    exposurePort: params.exposurePort,
    resolveCoordinate: () => resolveUrbanExposureCoordinate({ surface: params.surface }),
    applyExposure: applyUrbanCatalogCardExposure,
  });
}

async function mapTourToExposureAwareEgress(params: {
  readonly tenantId: string;
  readonly tour: UrbanTourRecord;
  readonly surface: (typeof URBAN_EXPOSURE_SURFACE)[keyof typeof URBAN_EXPOSURE_SURFACE];
  readonly exposurePort?: UrbanExposureResolverPort;
}): Promise<UrbanPublicCatalogEgress> {
  const input: PublicCatalogTourInput = {
    id: params.tour.id,
    canonical: params.tour.canonical as unknown as CanonicalDocument,
    catalogUpdatedAt: params.tour.createdAt,
  };
  const card = toUrbanPublicCatalogCard(input);
  return applyCatalogExposure({
    tenantId: params.tenantId,
    tour: input,
    card,
    surface: params.surface,
    exposurePort: params.exposurePort,
  });
}

export async function listUrbanCatalog(params: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly store: UrbanTourStorePort;
  readonly exposurePort?: UrbanExposureResolverPort;
  readonly limit?: number;
  readonly cursor?: string;
  readonly city?: string;
}): Promise<UrbanCatalogListResult> {
  assertWorkspaceTypeOrThrow(
    params.workspaceType,
    URBAN_WORKSPACE_TYPE,
    () => new UrbanWorkspaceRequiredError(),
  );

  const limit = clampWorkspaceCatalogPageLimit({ limit: params.limit });
  const page = await params.store.listPage(
    { tenantId: params.tenantId },
    { limit: Number.MAX_SAFE_INTEGER },
  );

  let published = filterWorkspacePublishedTours(page.items, {
    isPublished: isUrbanTourPublished,
    getCanonical: (tour) => tour.canonical,
  });
  if (params.city !== undefined && params.city.trim().length > 0) {
    const cityNeedle = params.city.trim().toLowerCase();
    published = published.filter((tour) => {
      const card = toUrbanCatalogCard(tour);
      return (card.city ?? "").toLowerCase() === cityNeedle;
    });
  }

  published.sort((left, right) => {
    const leftAt = toUrbanCatalogCard(left).publishedAt ?? left.createdAt;
    const rightAt = toUrbanCatalogCard(right).publishedAt ?? right.createdAt;
    return rightAt.localeCompare(leftAt);
  });

  const { slice, nextCursor } = sliceWorkspaceCatalogByIdCursor(published, {
    limit,
    ...(params.cursor === undefined ? {} : { cursor: params.cursor }),
  });
  const items = await mapWorkspaceCatalogSliceAsync(slice, (tour) =>
    mapTourToExposureAwareEgress({
      tenantId: params.tenantId,
      tour,
      surface: URBAN_EXPOSURE_SURFACE.publicList,
      exposurePort: params.exposurePort,
    }),
  );
  return { items, nextCursor };
}

export async function getUrbanCatalogTour(params: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly store: UrbanTourStorePort;
  readonly exposurePort?: UrbanExposureResolverPort;
  readonly tourId: string;
}): Promise<UrbanPublicCatalogEgress | null> {
  assertWorkspaceTypeOrThrow(
    params.workspaceType,
    URBAN_WORKSPACE_TYPE,
    () => new UrbanWorkspaceRequiredError(),
  );
  const tour = await loadWorkspaceTourIfPublished({
    findFirst: () => params.store.findFirst({ tenantId: params.tenantId, id: params.tourId }),
    isPublished: isUrbanTourPublished,
    getCanonical: (row) => row.canonical,
  });
  if (tour === null) {
    return null;
  }
  return mapTourToExposureAwareEgress({
    tenantId: params.tenantId,
    tour,
    surface: URBAN_EXPOSURE_SURFACE.publicDetails,
    exposurePort: params.exposurePort,
  });
}
