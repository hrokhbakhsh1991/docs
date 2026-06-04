import type { IncomingMessage, ServerResponse } from "node:http";

import { readJsonBody, sendJson } from "../http/json";
import { resolveTenantContextFromRequest } from "../tenant-kernel/tenant-kernel";
import type { ToursService } from "./tours.service";

export type ToursRouteDeps = {
  readonly toursService: ToursService;
};

function mapErrorToStatus(message: string): number {
  if (message.startsWith("UNAUTHORIZED_")) return 401;
  if (message.startsWith("FORBIDDEN_")) return 403;
  if (message.startsWith("INVALID_TENANT_AUTH_CONTEXT")) return 401;
  if (message.startsWith("ZOD_VALIDATION_FAILED")) return 400;
  if (message.startsWith("CANONICAL_VALIDATION_FAILED")) return 400;
  if (message.startsWith("WORKSPACE_PLUGIN_NOT_BOUND")) return 400;
  if (message.startsWith("WORKSPACE_PLUGIN_NOT_FOUND")) return 500;
  if (message.startsWith("CANONICAL_SYNC_VALIDATION_FAILED")) return 409;
  if (message.startsWith("TOUR_CAPACITY_EXCEEDED")) return 429;
  if (message.startsWith("DUAL_WRITE_FORBIDDEN")) return 403;
  return 500;
}

export async function handleCreateTour(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ToursRouteDeps,
): Promise<void> {
  try {
    const rawBody = await readJsonBody<unknown>(req);
    const auth = await resolveTenantContextFromRequest(req);
    const record = await deps.toursService.createTour(auth, rawBody);
    sendJson(res, 201, {
      id: record.id,
      tenantId: record.tenantId,
      canonical: record.canonical,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = mapErrorToStatus(message);
    if (status === 500) {
      sendJson(res, 500, { error: "internal_error" });
      return;
    }
    sendJson(res, status, { error: message });
  }
}

export async function handleGetTour(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ToursRouteDeps,
  tourId: string,
): Promise<void> {
  try {
    const auth = await resolveTenantContextFromRequest(req);
    const record = await deps.toursService.getTourById(auth, tourId);
    if (!record) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }
    sendJson(res, 200, record);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = mapErrorToStatus(message);
    if (status === 500) {
      sendJson(res, 500, { error: "internal_error" });
      return;
    }
    sendJson(res, status, { error: message });
  }
}
