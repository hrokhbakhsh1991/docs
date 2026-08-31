import type { PublicCatalogTourInput } from "@app-tour/workspace-sdk";
import {
  applyWorkspaceCatalogCardExposure,
  assertWorkspaceTypeOrThrow,
  clampWorkspaceCatalogPageLimit,
  filterWorkspacePublishedTours,
  loadWorkspaceTourIfPublished,
  mapWorkspaceCatalogSliceAsync,
  sliceWorkspaceCatalogByIdCursor,
} from "@app-tour/workspace-sdk";
import {
  DENALI_EXPOSURE_SURFACE,
  resolveDenaliExposureCoordinate,
} from "../exposure/denali-exposure-surfaces";

import { withSpotsRemaining } from "@app-tour/tour-core";
import { applyDenaliCatalogCardExposure } from "../catalog/denali-catalog-exposure-bindings";
import { isDenaliTourPublished } from "../catalog/denali-publish-status";
import { isPersistedCatalogTourId } from "../catalog/is-persisted-catalog-tour-id";
import { toDenaliCatalogCard } from "../catalog/denali-catalog-card";
import { resolveDenaliCatalogPhotoEnrichment } from "../catalog/enrich-denali-catalog-photo-urls";
import {
  filterDenaliCatalogTourAvailability,
  filterDenaliCatalogTourRecords,
  sortDenaliCatalogTourRecords,
  type DenaliCatalogListQuery,
} from "../catalog/filter-denali-catalog-list";
import { collectItinerarySegmentDestinationIds } from "../catalog/project-denali-catalog-itinerary";
import { DENALI_WORKSPACE_TYPE } from "../denali-identity";
import { DenaliWorkspaceRequiredError } from "./errors/denali-workspace-required.error";
import type { DenaliExposureResolverPort } from "./ports/exposure-resolver.port";
import type { BookingPublicPort } from "./ports/public-booking.port";
import type { DenaliPublicDestinationPort } from "./ports/public-destination.port";
import type { DenaliTourStorePort } from "./ports/tour-store.port";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function collectDestinationIdsFromTours(tours: readonly PublicCatalogTourInput[]): readonly string[] {
  const ids = new Set<string>();
  for (const tour of tours) {
    const data = tour.canonical.data;
    if (isRecord(data)) {
      for (const destinationId of collectItinerarySegmentDestinationIds(data)) {
        ids.add(destinationId);
      }
    }
  }
  return Object.freeze([...ids]);
}

async function resolveDestinationNameById(params: {
  readonly tenantId: string;
  readonly tours: readonly PublicCatalogTourInput[];
  readonly destinationPort?: DenaliPublicDestinationPort;
}): Promise<ReadonlyMap<string, string> | undefined> {
  if (params.destinationPort === undefined) {
    return undefined;
  }
  const destinationIds = collectDestinationIdsFromTours(params.tours);
  if (destinationIds.length === 0) {
    return undefined;
  }
  const names = await params.destinationPort.getDestinationNamesByIds(
    params.tenantId,
    destinationIds
  );
  const entries = Object.entries(names).filter(
    ([, name]) => typeof name === "string" && name.trim().length > 0
  );
  return entries.length > 0 ? new Map(entries) : undefined;
}

async function applyCatalogExposure(params: {
  readonly tenantId: string;
  readonly tour: PublicCatalogTourInput;
  readonly card: ReturnType<typeof toDenaliCatalogCard>;
  readonly surface: (typeof DENALI_EXPOSURE_SURFACE)[keyof typeof DENALI_EXPOSURE_SURFACE];
  readonly exposurePort?: DenaliExposureResolverPort;
}): Promise<ReturnType<typeof toDenaliCatalogCard>> {
  return applyWorkspaceCatalogCardExposure({
    tenantId: params.tenantId,
    tourId: params.tour.id,
    canonical: params.tour.canonical,
    card: params.card,
    exposurePort: params.exposurePort,
    resolveCoordinate: () => resolveDenaliExposureCoordinate({ surface: params.surface }),
    applyExposure: applyDenaliCatalogCardExposure,
  });
}

async function mapTourToExposureAwareCard(params: {
  readonly tenantId: string;
  readonly tour: PublicCatalogTourInput & { readonly createdAt?: string };
  readonly destinationNameById: ReadonlyMap<string, string> | undefined;
  readonly surface: (typeof DENALI_EXPOSURE_SURFACE)[keyof typeof DENALI_EXPOSURE_SURFACE];
  readonly exposurePort?: DenaliExposureResolverPort;
}): Promise<ReturnType<typeof toDenaliCatalogCard>> {
  const tourInput: PublicCatalogTourInput = {
    id: params.tour.id,
    canonical: params.tour.canonical,
    catalogUpdatedAt: params.tour.catalogUpdatedAt ?? params.tour.createdAt,
  };
  const data = params.tour.canonical.data;
  const photoEnrichment = isRecord(data)
    ? await resolveDenaliCatalogPhotoEnrichment(data, params.tenantId)
    : undefined;
  const card = toDenaliCatalogCard(tourInput, {
    ...(params.destinationNameById === undefined
      ? {}
      : { destinationNameById: params.destinationNameById }),
    ...(photoEnrichment === undefined ? {} : { photoEnrichment }),
  });
  return applyCatalogExposure({
    tenantId: params.tenantId,
    tour: tourInput,
    card,
    surface: params.surface,
    exposurePort: params.exposurePort,
  });
}

async function enrichCatalogCardsWithSpots(params: {
  readonly tenantId: string;
  readonly cards: ReturnType<typeof toDenaliCatalogCard>[];
  readonly bookingPort?: BookingPublicPort;
}): Promise<ReturnType<typeof toDenaliCatalogCard>[]> {
  if (params.cards.length === 0) {
    return params.cards;
  }
  const approvedByTour =
    params.bookingPort === undefined
      ? {}
      : await params.bookingPort.sumApprovedPartySizeByTourIds(
          params.tenantId,
          params.cards.map((card) => card.id)
        );
  return params.cards.map((card) =>
    withSpotsRemaining(card, approvedByTour[card.id] ?? 0)
  );
}

export type DenaliCatalogListResult = {
  readonly items: ReturnType<typeof toDenaliCatalogCard>[];
  readonly nextCursor: string | null;
};

export async function listDenaliCatalog(params: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly store: DenaliTourStorePort;
  readonly bookingPort?: BookingPublicPort;
  readonly destinationPort?: DenaliPublicDestinationPort;
  readonly exposurePort?: DenaliExposureResolverPort;
  readonly limit?: number;
  readonly cursor?: string;
  readonly listQuery?: DenaliCatalogListQuery;
}): Promise<DenaliCatalogListResult> {
  assertWorkspaceTypeOrThrow(
    params.workspaceType,
    DENALI_WORKSPACE_TYPE,
    () => new DenaliWorkspaceRequiredError(),
  );

  const limit = clampWorkspaceCatalogPageLimit({ limit: params.limit });
  const listQuery = params.listQuery ?? {};
  const page = await params.store.listPage(
    { tenantId: params.tenantId },
    { limit: Number.MAX_SAFE_INTEGER }
  );

  let published = filterWorkspacePublishedTours(page.items, {
    isPublished: isDenaliTourPublished,
    getCanonical: (tour) => tour.canonical,
  });
  published = [...filterDenaliCatalogTourRecords(published, listQuery)];
  published = [
    ...(await filterDenaliCatalogTourAvailability(published, {
      tenantId: params.tenantId,
      availability: listQuery.availability,
      bookingPort: params.bookingPort,
    })),
  ];
  published = [...sortDenaliCatalogTourRecords(published, listQuery.sort ?? "newest")];

  const { slice, nextCursor } = sliceWorkspaceCatalogByIdCursor(published, {
    limit,
    ...(params.cursor === undefined ? {} : { cursor: params.cursor }),
  });
  const destinationNameById = await resolveDestinationNameById({
    tenantId: params.tenantId,
    tours: slice,
    destinationPort: params.destinationPort,
  });
  const cards = await mapWorkspaceCatalogSliceAsync(slice, (tour) =>
    mapTourToExposureAwareCard({
      tenantId: params.tenantId,
      tour,
      destinationNameById,
      surface: DENALI_EXPOSURE_SURFACE.publicList,
      exposurePort: params.exposurePort,
    }),
  );
  const items = await enrichCatalogCardsWithSpots({
    tenantId: params.tenantId,
    cards,
    bookingPort: params.bookingPort,
  });
  return {
    items,
    nextCursor,
  };
}

export async function getDenaliCatalogTour(params: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly store: DenaliTourStorePort;
  readonly bookingPort?: BookingPublicPort;
  readonly destinationPort?: DenaliPublicDestinationPort;
  readonly exposurePort?: DenaliExposureResolverPort;
  readonly tourId: string;
}) {
  assertWorkspaceTypeOrThrow(
    params.workspaceType,
    DENALI_WORKSPACE_TYPE,
    () => new DenaliWorkspaceRequiredError(),
  );
  if (!isPersistedCatalogTourId(params.tourId)) {
    return null;
  }
  const tour = await loadWorkspaceTourIfPublished({
    findFirst: () => params.store.findFirst({ tenantId: params.tenantId, id: params.tourId }),
    isPublished: isDenaliTourPublished,
    getCanonical: (row) => row.canonical,
  });
  if (tour === null) {
    return null;
  }
  const destinationNameById = await resolveDestinationNameById({
    tenantId: params.tenantId,
    tours: [tour],
    destinationPort: params.destinationPort,
  });
  const card = await mapTourToExposureAwareCard({
    tenantId: params.tenantId,
    tour,
    destinationNameById,
    surface: DENALI_EXPOSURE_SURFACE.publicDetails,
    exposurePort: params.exposurePort,
  });
  const [enriched] = await enrichCatalogCardsWithSpots({
    tenantId: params.tenantId,
    cards: [card],
    bookingPort: params.bookingPort,
  });
  return enriched ?? card;
}
