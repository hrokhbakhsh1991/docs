import type { IncomingMessage, ServerResponse } from "node:http";

import { handleHealth } from "../health/health.routes";

/**
 * Minimal HTTP surface for outbox-relay worker pods (DEC-118).
 */
export function createRelayWorkerListener(): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "GET" && url.pathname === "/health") {
      void handleHealth(req, res);
      return;
    }
    res.statusCode = 404;
    res.end();
  };
}
