import type { IncomingMessage, ServerResponse } from "node:http";

import {
  buildGuestClubSmokeCatalogCard,
  GUEST_CLUB_SMOKE_PUBLISHED_TOUR_ID,
} from "../catalog/guest-club-smoke-catalog.fixture";

function isGuestClubSmokeSeedEnabled(): boolean {
  return process.env.GUEST_CLUB_SMOKE_E2E_SEED === "1";
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function sendGuestStub(res: ServerResponse): void {
  sendJson(res, 501, { success: false, code: "WORKSPACE_GUEST_STUB" });
}

function sendNotFound(res: ServerResponse): void {
  sendJson(res, 404, { success: false, error: "not_found", code: "NOT_FOUND" });
}

export async function handleGetGuestClubCatalog(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (!isGuestClubSmokeSeedEnabled()) {
    sendGuestStub(res);
    return;
  }

  const card = buildGuestClubSmokeCatalogCard();
  sendJson(res, 200, {
    success: true,
    data: { items: [card] },
    metadata: { nextCursor: null },
  });
}

export async function handleGetGuestClubCatalogTour(
  _req: IncomingMessage,
  res: ServerResponse,
  tourId: string
): Promise<void> {
  if (!isGuestClubSmokeSeedEnabled()) {
    sendGuestStub(res);
    return;
  }

  if (tourId.trim() !== GUEST_CLUB_SMOKE_PUBLISHED_TOUR_ID) {
    sendNotFound(res);
    return;
  }

  sendJson(res, 200, {
    success: true,
    data: buildGuestClubSmokeCatalogCard(),
  });
}
