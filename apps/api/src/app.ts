import type { IncomingMessage, ServerResponse } from "node:http";

import { ProvisioningService } from "./internal/provisioning.service";
import { handleHealth } from "./health/health.routes";
import { resolveTraceIdFromHeaders } from "./observability/resolve-trace-id";
import { runWithTraceContext } from "./observability/trace-request-context";
import { handleHttpError } from "./middleware/error-interceptor";
import { handleDbPoolHold } from "./routes/internal/db-pool-hold";
import { handleProvisionTenant } from "./routes/internal/tenants";
import { handleTenantConfig } from "./tenant/tenant-config.routes";
import {
  handleCreateTour,
  handleGetTour,
  handlePatchTour,
  type ToursRouteDeps,
} from "./tours/tours.routes";

export type AppDeps = ToursRouteDeps & {
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

  if (method === "GET" && url.pathname === "/api/v2/tenant-config") {
    await handleTenantConfig(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/internal/tenants/provision") {
    await handleProvisionTenant(req, res, {
      provisioningService: deps.provisioningService ?? new ProvisioningService(),
    });
    return;
  }

  if (method === "GET" && url.pathname === "/internal/test/db-pool-hold") {
    await handleDbPoolHold(req, res);
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

  if (method === "PATCH" && tourMatch) {
    await handlePatchTour(req, res, deps, tourMatch[1]!);
    return;
  }

  res.statusCode = 404;
  res.end();
}

export function createRequestListener(deps: AppDeps) {
  const provisioningService = deps.provisioningService ?? new ProvisioningService();
  const appDeps: AppDeps = { ...deps, provisioningService };

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const traceId = resolveTraceIdFromHeaders(req.headers);
    await runWithTraceContext(traceId, async () => {
      try {
        await dispatchRequest(req, res, appDeps);
      } catch (error) {
        handleHttpError(res, error);
      }
    });
  };
}
