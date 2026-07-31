import type { IncomingMessage, ServerResponse } from "node:http";

import { createWorkspaceGuestSmokeHttpHandlers } from "@app-tour/workspace-sdk";

import {
  buildGuestClubSmokeCatalogCard,
  GUEST_CLUB_SMOKE_PUBLISHED_TOUR_ID,
} from "../catalog/guest-club-smoke-catalog.fixture";

function isGuestClubSmokeSeedEnabled(): boolean {
  return process.env.GUEST_CLUB_SMOKE_E2E_SEED === "1";
}

const handlers = createWorkspaceGuestSmokeHttpHandlers({
  isSeedEnabled: isGuestClubSmokeSeedEnabled,
  publishedTourId: GUEST_CLUB_SMOKE_PUBLISHED_TOUR_ID,
  buildCard: buildGuestClubSmokeCatalogCard,
});

export async function handlePostGuestClubRegistration(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  return handlers.handleRegister(req, res);
}

export async function handleGetGuestClubCatalog(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  return handlers.handleList(req, res);
}

export async function handleGetGuestClubCatalogTour(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
): Promise<void> {
  return handlers.handleDetail(req, res, tourId);
}
