import type { IncomingMessage, ServerResponse } from "node:http";

import { sendJson } from "./json";
import { isGracefulShutdownInProgress } from "../server/graceful-shutdown";

/** Reject new HTTP work during SIGTERM drain (DEC-101 / RB-GAP-09). */
export function rejectRequestDuringShutdown(_req: IncomingMessage, res: ServerResponse): boolean {
  if (!isGracefulShutdownInProgress()) {
    return false;
  }
  res.setHeader("Connection", "close");
  sendJson(res, 503, {
    status: "shutting_down",
    service: "@apps/api",
  });
  return true;
}
