import type { IncomingMessage, ServerResponse } from "node:http";

import { createWorkspaceGuestSmokeHttpHandlers } from "@app-tour/workspace-sdk";

import {
  buildCertClubSmokeCatalogCard,
  CERT_CLUB_SMOKE_TOUR_ID,
} from "../catalog/cert-club-smoke-catalog.fixture";

function isSmokeSeedEnabled(): boolean {
  return process.env.CERT_CLUB_SMOKE_E2E_SEED === "1";
}

const handlers = createWorkspaceGuestSmokeHttpHandlers({
  isSeedEnabled: isSmokeSeedEnabled,
  publishedTourId: CERT_CLUB_SMOKE_TOUR_ID,
  buildCard: buildCertClubSmokeCatalogCard,
});

export async function handlePostCertClubRegistration(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  return handlers.handleRegister(req, res);
}

export async function handleGetCertClubCatalog(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  return handlers.handleList(req, res);
}

export async function handleGetCertClubCatalogTour(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string
): Promise<void> {
  return handlers.handleDetail(req, res, tourId);
}
