import type { IncomingMessage, ServerResponse } from "node:http";

import { handleHealth } from "./health/health.routes";
import { handleTenantConfig } from "./tenant/tenant-config.routes";
import { handleCreateTour, handleGetTour, type ToursRouteDeps } from "./tours/tours.routes";

export type AppDeps = ToursRouteDeps;

export function createRequestListener(deps: AppDeps) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const method = req.method ?? "GET";

    if (method === "GET" && url.pathname === "/health") {
      handleHealth(req, res);
      return;
    }

    if (method === "GET" && url.pathname === "/api/v2/tenant-config") {
      await handleTenantConfig(req, res);
      return;
    }

    if (method === "POST" && url.pathname === "/tours") {
      await handleCreateTour(req, res, deps);
      return;
    }

    const tourMatch = url.pathname?.match(/^\/tours\/([^/]+)$/);
    if (method === "GET" && tourMatch) {
      await handleGetTour(req, res, deps, tourMatch[1]!);
      return;
    }

    res.statusCode = 404;
    res.end();
  };
}
