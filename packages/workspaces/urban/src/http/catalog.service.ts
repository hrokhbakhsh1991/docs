import { UrbanWorkspaceRequiredError } from "./errors/urban-workspace-required.error";
import { isUrbanTourPublished, toUrbanCatalogCard } from "./publish-status";
import type { UrbanTourStorePort } from "./ports/tour-store.port";

export type UrbanCatalogListResult = {
  readonly items: ReturnType<typeof toUrbanCatalogCard>[];
  readonly nextCursor: string | null;
};

export async function listUrbanCatalog(params: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly store: UrbanTourStorePort;
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
  return {
    items: slice.map(toUrbanCatalogCard),
    nextCursor: hasMore && slice.length > 0 ? slice[slice.length - 1]!.id : null,
  };
}

export async function getUrbanCatalogTour(params: {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly store: UrbanTourStorePort;
  readonly tourId: string;
}) {
  if (params.workspaceType !== "urban") {
    throw new UrbanWorkspaceRequiredError();
  }
  const tour = await params.store.findFirst({ tenantId: params.tenantId, id: params.tourId });
  if (tour === null || !isUrbanTourPublished(tour.canonical)) {
    return null;
  }
  return toUrbanCatalogCard(tour);
}
