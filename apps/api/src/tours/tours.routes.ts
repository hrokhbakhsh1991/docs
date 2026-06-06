import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import {
  hashIdempotentRequest,
  readIdempotencyKey,
  runIdempotentCreateTour,
} from "../http/http-idempotency";
import { readRequestBodyRaw, sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { resolveTenantContextFromRequest } from "../tenant-kernel/tenant-kernel";
import type { ToursService } from "./tours.service";

export type ToursRouteDeps = {
  readonly toursService: ToursService;
};

export async function handleCreateTour(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ToursRouteDeps
): Promise<void> {
  try {
    const rawBody = await readRequestBodyRaw(req);
    const parsedBody = rawBody.trim().length === 0 ? {} : (JSON.parse(rawBody) as unknown);
    const auth = await resolveTenantContextFromRequest(req);
    const idempotencyKey = readIdempotencyKey(req);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const finish = async () => {
          const record = await deps.toursService.createTour(auth, parsedBody);
          return {
            id: record.id,
            tenantId: record.tenantId,
            canonical: record.canonical,
          };
        };

        if (idempotencyKey === undefined) {
          const body = await finish();
          sendJson(res, 201, body);
          return;
        }

        const requestHash = hashIdempotentRequest(req.method ?? "POST", "/tours", rawBody);
        const body = await runIdempotentCreateTour(
          auth.tenantId,
          idempotencyKey,
          requestHash,
          finish
        );
        sendJson(res, 201, body);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handlePatchTour(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ToursRouteDeps,
  tourId: string
): Promise<void> {
  try {
    const rawBody = await readRequestBodyRaw(req);
    const parsedBody = rawBody.trim().length === 0 ? {} : (JSON.parse(rawBody) as unknown);
    const auth = await resolveTenantContextFromRequest(req);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const record = await deps.toursService.updateTour(auth, tourId, parsedBody);
        sendJson(res, 200, {
          id: record.id,
          tenantId: record.tenantId,
          canonical: record.canonical,
          rowVersion: record.rowVersion,
        });
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleGetTour(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ToursRouteDeps,
  tourId: string
): Promise<void> {
  try {
    const auth = await resolveTenantContextFromRequest(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const record = await deps.toursService.getTourById(auth, tourId);
        if (!record) {
          sendHttpError(res, 404, { error: "not_found", code: "TOUR_NOT_FOUND" });
          return;
        }
        sendJson(res, 200, record);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}
