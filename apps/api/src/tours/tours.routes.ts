import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import {
  hashIdempotentRequest,
  readIdempotencyKey,
  runIdempotentCreateTour,
} from "../http/http-idempotency";
import { sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { resolveTenantContextFromRequest } from "../tenant-kernel/tenant-kernel";
import { parseCreateTourBody } from "./create-tour.schema";
import { parseListToursQuery } from "./list-tours-query";
import { readTourRequestBody } from "./read-tour-request-body";
import type { ToursService } from "./tours.service";
import { parseUpdateTourBody } from "./update-tour.schema";

export type ToursRouteDeps = {
  readonly toursService: ToursService;
};

export async function handleCreateTour(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ToursRouteDeps
): Promise<void> {
  try {
    const { rawBody, parsedBody } = await readTourRequestBody(req);
    const body = parseCreateTourBody(parsedBody);
    const auth = await resolveTenantContextFromRequest(req);
    const idempotencyKey = readIdempotencyKey(req);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const finish = async () => {
          const record = await deps.toursService.createTour(auth, body);
          return {
            id: record.id,
            tenantId: record.tenantId,
            canonical: record.canonical,
          };
        };

        if (idempotencyKey === undefined) {
          const responseBody = await finish();
          sendJson(res, 201, responseBody);
          return;
        }

        const requestHash = hashIdempotentRequest(req.method ?? "POST", "/tours", rawBody);
        const responseBody = await runIdempotentCreateTour(
          auth.tenantId,
          idempotencyKey,
          requestHash,
          finish
        );
        sendJson(res, 201, responseBody);
      },
      { rateLimit: "write", tourWriteConcurrency: true }
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
    const { parsedBody } = await readTourRequestBody(req);
    const body = parseUpdateTourBody(parsedBody);
    const auth = await resolveTenantContextFromRequest(req);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const record = await deps.toursService.updateTour(auth, tourId, body);
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

export async function handleListTours(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ToursRouteDeps
): Promise<void> {
  try {
    const auth = await resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const query = parseListToursQuery(url.searchParams);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await deps.toursService.listTours(auth, query);
        sendJson(res, 200, result);
      },
      { rateLimit: "read" }
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
