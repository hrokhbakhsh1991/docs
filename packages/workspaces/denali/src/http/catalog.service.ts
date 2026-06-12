import type { PublicCatalogTourInput } from "@app-tour/workspace-sdk";

import { withSpotsRemaining } from "../catalog/compute-spots-remaining";
import { isDenaliTourPublished } from "../catalog/denali-publish-status";
import { toDenaliCatalogCard } from "../catalog/denali-catalog-card";
import { collectItinerarySegmentDestinationIds } from "../catalog/project-denali-catalog-itinerary";
import { DenaliWorkspaceRequiredError } from "./errors/denali-workspace-required.error";
import type { DenaliPublicBookingPort } from "./ports/public-booking.port";
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

function mapToursToCatalogCards(
  tours: readonly PublicCatalogTourInput[],
  destinationNameById: ReadonlyMap<string, string> | undefined
): ReturnType<typeof toDenaliCatalogCard>[] {
  return tours.map((tour) =>
    toDenaliCatalogCard(
      tour,
      destinationNameById === undefined ? undefined : { destinationNameById }
    )
  );
}

async function enrichCatalogCardsWithSpots(params: {
  readonly tenantId: string;
  readonly cards: ReturnType<typeof toDenaliCatalogCard>[];
  readonly bookingPort?: DenaliPublicBookingPort;
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
  readonly bookingPort?: DenaliPublicBookingPort;
  readonly destinationPort?: DenaliPublicDestinationPort;
  readonly limit?: number;
  readonly cursor?: string;
}): Promise<DenaliCatalogListResult> {
  if (params.workspaceType !== "denali") {
    throw new DenaliWorkspaceRequiredError();
  }

  const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
  const page = await params.store.listPage(
    { tenantId: params.tenantId },
    { limit: Number.MAX_SAFE_INTEGER }
  );

  let published = page.items.filter((tour) => isDenaliTourPublished(tour.canonical));
  published.sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  let startIdx = 0;
  if (params.cursor !== undefined) {
    const cursorIdx = published.findIndex((tour) => tour.id === params.cursor);
    if (cursorIdx >= 0) {
      startIdx = cursorIdx + 1;
    }
  }

  const slice = published.slice(startIdx, startIdx + limit);
  const hasMore = startIdx + slice.length < published.length;
  const destinationNameById = await resolveDestinationNameById({
    tenantId: params.tenantId,
    tours: slice,
    destinationPort: params.destinationPort,
  });
  const cards = mapToursToCatalogCards(slice, destinationNameById);
  const items = await enrichCatalogCardsWithSpots({
    tenantId: params.tenantId,
    cards,
    bookingPort: params.bookingPort,
  });
  return {
    items,
    nextCursor: hasMore && slice.length > 0 ? slice[slice.length - 1]!.id : null,
  };
}

export async function getDenaliCatalogTour(params: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly store: DenaliTourStorePort;
  readonly bookingPort?: DenaliPublicBookingPort;
  readonly destinationPort?: DenaliPublicDestinationPort;
  readonly tourId: string;
}) {
  if (params.workspaceType !== "denali") {
    throw new DenaliWorkspaceRequiredError();
  }
  const tour = await params.store.findFirst({ tenantId: params.tenantId, id: params.tourId });
  if (tour === null || !isDenaliTourPublished(tour.canonical)) {
    return null;
  }
  const destinationNameById = await resolveDestinationNameById({
    tenantId: params.tenantId,
    tours: [tour],
    destinationPort: params.destinationPort,
  });
  const [card] = mapToursToCatalogCards([tour], destinationNameById);
  const [enriched] = await enrichCatalogCardsWithSpots({
    tenantId: params.tenantId,
    cards: [card],
    bookingPort: params.bookingPort,
  });
  return enriched ?? card;
}
