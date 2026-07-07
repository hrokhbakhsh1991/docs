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

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (text.trim().length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

export async function handlePostGuestClubRegistration(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (!isGuestClubSmokeSeedEnabled()) {
    sendGuestStub(res);
    return;
  }

  try {
    const raw = (await readJsonBody(req)) as {
      tourId?: unknown;
      contact?: { fullName?: unknown; email?: unknown };
      partySize?: unknown;
    };
    const tourId = typeof raw.tourId === "string" ? raw.tourId.trim() : "";
    const fullName =
      typeof raw.contact?.fullName === "string" ? raw.contact.fullName.trim() : "";
    const partySize =
      typeof raw.partySize === "number"
        ? raw.partySize
        : Number.parseInt(String(raw.partySize ?? ""), 10);

    if (tourId !== GUEST_CLUB_SMOKE_PUBLISHED_TOUR_ID) {
      sendNotFound(res);
      return;
    }
    if (fullName.length === 0 || !Number.isFinite(partySize) || partySize < 1) {
      sendJson(res, 400, { success: false, code: "INVALID_PAYLOAD" });
      return;
    }

    sendJson(res, 201, {
      success: true,
      data: {
        id: `00000000-0000-4000-8000-${String(Date.now()).slice(-12)}`,
        tourId,
        status: "pending",
      },
    });
  } catch {
    sendJson(res, 400, { success: false, code: "INVALID_PAYLOAD" });
  }
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
