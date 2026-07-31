import type { IncomingMessage, ServerResponse } from "node:http";

import {
  createWorkspaceGuestSmokeHttpHandlers,
  type WorkspaceGuestSmokeCatalogPort,
} from "@app-tour/workspace-sdk";

import {
  buildHarborSmokeCatalogCard,
  HARBOR_SMOKE_PUBLISHED_TOUR_ID,
  type HarborSmokeCatalogCard,
} from "../catalog/harbor-smoke-catalog.fixture";
import { getHarborSmokeCatalogStore } from "../catalog/harbor-smoke-catalog.store";

function isHarborSmokeSeedEnabled(): boolean {
  return process.env.HARBOR_SMOKE_E2E_SEED === "1";
}

function filterHarborSmokeCardsByCity(
  items: readonly HarborSmokeCatalogCard[],
  url: URL,
): readonly HarborSmokeCatalogCard[] {
  const city = url.searchParams.get("city") ?? undefined;
  if (city === undefined || city.trim().length === 0) {
    return items;
  }
  const needle = city.trim().toLowerCase();
  return items.filter((card) => card.city.toLowerCase() === needle);
}

/** Resolve store per call so test resets replace the singleton safely. */
const harborCatalogPort: WorkspaceGuestSmokeCatalogPort<HarborSmokeCatalogCard> = {
  listPublished: () => getHarborSmokeCatalogStore().listPublished(),
  getPublished: (tourId) => getHarborSmokeCatalogStore().getPublished(tourId),
  createRegistration: (input) => getHarborSmokeCatalogStore().createRegistration(input),
};

const handlers = createWorkspaceGuestSmokeHttpHandlers({
  isSeedEnabled: isHarborSmokeSeedEnabled,
  publishedTourId: HARBOR_SMOKE_PUBLISHED_TOUR_ID,
  buildCard: buildHarborSmokeCatalogCard,
  catalogPort: harborCatalogPort,
  filterListItems: filterHarborSmokeCardsByCity,
  applyListLimit: true,
});

export async function handlePostHarborRegistration(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  return handlers.handleRegister(req, res);
}

export async function handleGetHarborCatalog(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  return handlers.handleList(req, res);
}

export async function handleGetHarborCatalogTour(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
): Promise<void> {
  return handlers.handleDetail(req, res, tourId);
}
