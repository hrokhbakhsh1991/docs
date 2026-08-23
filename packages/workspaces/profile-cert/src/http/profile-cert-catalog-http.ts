import type { IncomingMessage, ServerResponse } from "node:http";

import { createWorkspaceGuestSmokeHttpHandlers } from "@app-tour/workspace-sdk";

import {
  buildProfileCertSmokeCatalogCard,
  PROFILE_CERT_SMOKE_TOUR_ID,
} from "../catalog/profile-cert-smoke-catalog.fixture";

function isSmokeSeedEnabled(): boolean {
  return process.env.PROFILE_CERT_SMOKE_E2E_SEED === "1";
}

const handlers = createWorkspaceGuestSmokeHttpHandlers({
  isSeedEnabled: isSmokeSeedEnabled,
  publishedTourId: PROFILE_CERT_SMOKE_TOUR_ID,
  buildCard: buildProfileCertSmokeCatalogCard,
});

export async function handlePostProfileCertRegistration(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  return handlers.handleRegister(req, res);
}

export async function handleGetProfileCertCatalog(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  return handlers.handleList(req, res);
}

export async function handleGetProfileCertCatalogTour(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string
): Promise<void> {
  return handlers.handleDetail(req, res, tourId);
}
