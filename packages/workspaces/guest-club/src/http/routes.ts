import type { IncomingMessage, ServerResponse } from "node:http";

import { GUEST_CLUB_HTTP_ROUTE_MANIFEST } from "./routes-manifest";

function sendGuestStub(res: ServerResponse): void {
  res.statusCode = 501;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ success: false, code: "WORKSPACE_GUEST_STUB" }));
}

export async function handlePostGuestClubRegistration(
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  sendGuestStub(res);
}

export { handleGetGuestClubCatalog, handleGetGuestClubCatalogTour } from "./guest-club-catalog-http";
export { GUEST_CLUB_HTTP_ROUTE_MANIFEST };
