import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import {
  hashIdempotentRequest,
  readIdempotencyKey,
  runIdempotentCreateTour,
} from "../http/http-idempotency";
import { sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { requireOperatorSession } from "../identity/require-operator-session";
import {
  resolveTenantContextFromRequest,
} from "../tenant-kernel/tenant-kernel";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { assertTourPublishFieldOwner } from "./assert-tour-publish-field-owner";
import {
  tourPatchTouchesProtectedPublishFields,
  tourPublishFieldOwnerSurface,
} from "./workspace-tour-write-dispatch";
import { parseCloneTourBody } from "./clone-tour.schema";
import { parseCreateTourBody } from "./create-tour.schema";
import { getTourOperator } from "./get-tour-operator";
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
    const auth = await requireOperatorSession(req);
    const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);
    if (auth.role === "member" && workspaceType === "denali") {
      sendHttpError(res, 403, { error: "forbidden", code: "OPERATOR_TOUR_WRITE_FORBIDDEN" });
      return;
    }
    if (tourPatchTouchesProtectedPublishFields(workspaceType, body)) {
      const surface = tourPublishFieldOwnerSurface(workspaceType);
      if (surface !== undefined) {
        assertTourPublishFieldOwner({
          auth,
          workspaceType,
          surface,
        });
      }
    }

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
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const query = parseListToursQuery(url.searchParams);

    if (query.view === "slim") {
      const auth = await resolveTenantContextFromRequest(req);
      await runWithHttpRequestContext(
        req,
        auth,
        async () => {
          const result = await deps.toursService.listTours(auth, query);
          sendJson(res, 200, result);
        },
        { rateLimit: "read" }
      );
      return;
    }

    const auth = await requireOperatorSession(req);
    const operatorQuery = query.operator;
    if (operatorQuery === undefined) {
      sendHttpError(res, 400, { error: "invalid_query", code: "INVALID_OPERATOR_LIST_QUERY" });
      return;
    }

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await deps.toursService.listToursOperator(auth, operatorQuery);
        sendJson(res, 200, result);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleCloneTour(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ToursRouteDeps,
  tourId: string
): Promise<void> {
  try {
    const { parsedBody } = await readTourRequestBody(req);
    const body = parseCloneTourBody(parsedBody);
    const auth = await requireOperatorSession(req);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const record = await deps.toursService.cloneTour(auth, tourId, body);
        sendJson(res, 201, {
          id: record.id,
          tenantId: record.tenantId,
          canonical: record.canonical,
        });
      },
      { rateLimit: "write", tourWriteConcurrency: true }
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
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const detail = await getTourOperator(deps.toursService, auth, tourId);
        if (detail === null) {
          sendHttpError(res, 404, { error: "not_found", code: "TOUR_NOT_FOUND" });
          return;
        }
        sendJson(res, 200, detail);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}
