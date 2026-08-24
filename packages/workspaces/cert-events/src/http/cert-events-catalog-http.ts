import type { IncomingMessage, ServerResponse } from "node:http";

import { createWorkspaceGuestSmokeHttpHandlers } from "@app-tour/workspace-sdk";

import {
  buildCertEventsSmokeCatalogCard,
  CERT_EVENTS_SMOKE_TOUR_ID,
} from "../catalog/cert-events-smoke-catalog.fixture";

function isSmokeSeedEnabled(): boolean {
  return process.env.CERT_EVENTS_SMOKE_E2E_SEED === "1";
}

const handlers = createWorkspaceGuestSmokeHttpHandlers({
  isSeedEnabled: isSmokeSeedEnabled,
  publishedTourId: CERT_EVENTS_SMOKE_TOUR_ID,
  buildCard: buildCertEventsSmokeCatalogCard,
});

export async function handlePostCertEventsRegistration(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  return handlers.handleRegister(req, res);
}

export async function handleGetCertEventsCatalog(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  return handlers.handleList(req, res);
}

export async function handleGetCertEventsCatalogTour(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string
): Promise<void> {
  return handlers.handleDetail(req, res, tourId);
}
