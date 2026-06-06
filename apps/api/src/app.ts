import type { IncomingMessage, ServerResponse } from "node:http";

import type { ProvisioningService } from "./internal/provisioning.service";
import { loadLazyRouteHandlers } from "./boot/lazy-route-handlers";
import { resolveLazyToursService } from "./boot/lazy-tours-service";
import { handleHealth } from "./health/health.routes";
import { resolveTraceIdFromHeaders } from "./observability/resolve-trace-id";
import { runWithTraceContext } from "./observability/trace-request-context";
import { handleHttpError, sendHttpError } from "./middleware/error-interceptor";
import { rejectRequestDuringShutdown } from "./http/shutdown-ingress";
import type { MapEnrichRouteDeps } from "./routes/api-v2/map-enrich.routes";
import type { ToursRouteDeps } from "./tours/tours.routes";

export type AppDeps = Partial<ToursRouteDeps> &
  MapEnrichRouteDeps & {
    readonly provisioningService?: ProvisioningService;
  };

async function dispatchRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: AppDeps
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const method = req.method ?? "GET";

  if (method === "GET" && url.pathname === "/health") {
    handleHealth(req, res);
    return;
  }

  const handlers = await loadLazyRouteHandlers();

  if (method === "GET" && url.pathname === "/internal/metrics") {
    await handlers.handleInternalMetrics(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/internal/cache/invalidate") {
    await handlers.handleCacheInvalidate(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/api/v2/tenant-config") {
    await handlers.handleTenantConfig(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/api/v2/map/enrich") {
    await handlers.handleMapEnrich(req, res, deps);
    return;
  }

  if (method === "POST" && url.pathname === "/internal/tenants/provision") {
    const { ProvisioningService } = await import("./internal/provisioning.service");
    await handlers.handleProvisionTenant(req, res, {
      provisioningService: deps.provisioningService ?? new ProvisioningService(),
    });
    return;
  }

  if (method === "GET" && url.pathname === "/internal/test/db-pool-hold") {
    await handlers.handleDbPoolHold(req, res);
    return;
  }

  const outboxReplayMatch = url.pathname.match(/^\/internal\/outbox\/([^/]+)\/replay$/);
  if (method === "POST" && outboxReplayMatch) {
    await handlers.handleReplayOutbox(req, res, outboxReplayMatch[1]!);
    return;
  }

  const toursService = await resolveLazyToursService(deps.toursService);
  const tourDeps: ToursRouteDeps = { toursService };

  if (method === "POST" && url.pathname === "/tours") {
    await handlers.handleCreateTour(req, res, tourDeps);
    return;
  }

  if (method === "GET" && url.pathname === "/tours") {
    await handlers.handleListTours(req, res, tourDeps);
    return;
  }

  const tourMatch = url.pathname?.match(/^\/tours\/([^/]+)$/);
  if (method === "GET" && tourMatch) {
    await handlers.handleGetTour(req, res, tourDeps, tourMatch[1]!);
    return;
  }

  if (method === "PATCH" && tourMatch) {
    await handlers.handlePatchTour(req, res, tourDeps, tourMatch[1]!);
    return;
  }

  sendHttpError(res, 404, { error: "not_found", code: "NOT_FOUND" });
}

export function createRequestListener(deps: AppDeps = {}) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (rejectRequestDuringShutdown(req, res)) {
      return;
    }
    const traceId = resolveTraceIdFromHeaders(req.headers);
    await runWithTraceContext(traceId, async () => {
      try {
        await dispatchRequest(req, res, deps);
      } catch (error) {
        handleHttpError(res, error);
      }
    });
  };
}
