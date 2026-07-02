import type { CanonicalDocument, PublicCatalogTourInput } from "@app-tour/workspace-sdk";

import { applyUrbanCatalogCardExposure } from "../catalog/urban-catalog-exposure-bindings";
import type { UrbanPublicCatalogEgress } from "../catalog/urban-public-catalog-surface";
import { toUrbanPublicCatalogCard } from "../catalog/urban-public-catalog-surface";
import {
  URBAN_EXPOSURE_SURFACE,
  resolveUrbanExposureCoordinate,
} from "../exposure/urban-exposure-surfaces";
import { UrbanWorkspaceRequiredError } from "./errors/urban-workspace-required.error";
import type { UrbanExposureResolverPort } from "./ports/exposure-resolver.port";
import { isUrbanTourPublished, toUrbanCatalogCard } from "./publish-status";
import type { UrbanTourRecord, UrbanTourStorePort } from "./ports/tour-store.port";

export type UrbanCatalogListResult = {
  readonly items: readonly UrbanPublicCatalogEgress[];
  readonly nextCursor: string | null;
};

async function mapCatalogSliceWithExposure<T>(
  slice: readonly T[],
  mapper: (tour: T) => Promise<UrbanPublicCatalogEgress>,
): Promise<UrbanPublicCatalogEgress[]> {
  const items: UrbanPublicCatalogEgress[] = [];
  for (const tour of slice) {
    items.push(await mapper(tour));
  }
  return items;
}

async function applyCatalogExposure(params: {
  readonly tenantId: string;
  readonly tour: PublicCatalogTourInput;
  readonly card: UrbanPublicCatalogEgress;
  readonly surface: (typeof URBAN_EXPOSURE_SURFACE)[keyof typeof URBAN_EXPOSURE_SURFACE];
  readonly exposurePort?: UrbanExposureResolverPort;
}): Promise<UrbanPublicCatalogEgress> {
  if (params.exposurePort === undefined) {
    return params.card;
  }
  const visibleFieldIds = await params.exposurePort.resolveVisibleFieldIds({
    tenantId: params.tenantId,
    tourId: params.tour.id,
    canonical: params.tour.canonical,
    coordinate: resolveUrbanExposureCoordinate({ surface: params.surface }),
  });
  return applyUrbanCatalogCardExposure(params.card, new Set(visibleFieldIds));
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
  if (params.workspaceType !== "urban") {
    throw new UrbanWorkspaceRequiredError();
  }

  const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
  const page = await params.store.listPage(
    { tenantId: params.tenantId },
    { limit: Number.MAX_SAFE_INTEGER }
  );

  let published = page.items.filter((tour) => isUrbanTourPublished(tour.canonical));
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

  let startIdx = 0;
  if (params.cursor !== undefined) {
    const cursorIdx = published.findIndex((tour) => tour.id === params.cursor);
    if (cursorIdx >= 0) {
      startIdx = cursorIdx + 1;
    }
  }

  const slice = published.slice(startIdx, startIdx + limit);
  const hasMore = startIdx + slice.length < published.length;
  const items = await mapCatalogSliceWithExposure(slice, (tour) =>
    mapTourToExposureAwareEgress({
      tenantId: params.tenantId,
      tour,
      surface: URBAN_EXPOSURE_SURFACE.publicList,
      exposurePort: params.exposurePort,
    }),
  );
  return {
    items,
    nextCursor: hasMore && slice.length > 0 ? slice[slice.length - 1]!.id : null,
  };
}

export async function getUrbanCatalogTour(params: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly store: UrbanTourStorePort;
  readonly exposurePort?: UrbanExposureResolverPort;
  readonly tourId: string;
}): Promise<UrbanPublicCatalogEgress | null> {
  if (params.workspaceType !== "urban") {
    throw new UrbanWorkspaceRequiredError();
  }
  const tour = await params.store.findFirst({ tenantId: params.tenantId, id: params.tourId });
  if (tour === null || !isUrbanTourPublished(tour.canonical)) {
    return null;
  }
  return mapTourToExposureAwareEgress({
    tenantId: params.tenantId,
    tour,
    surface: URBAN_EXPOSURE_SURFACE.publicDetails,
    exposurePort: params.exposurePort,
  });
}
