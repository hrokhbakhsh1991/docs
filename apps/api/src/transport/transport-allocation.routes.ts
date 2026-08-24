import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { readJsonBody } from "../http/json";
import { sendJson } from "../http/json";
import { handleHttpError } from "../middleware/error-interceptor";
import { requireOperatorSession } from "../identity/require-operator-session";
import {
  getTransportAllocationsForTour,
  putTransportAllocations,
} from "../settlement/driver-settlement.service.ts";

export async function handleGetTransportAllocations(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const allocations = await getTransportAllocationsForTour(auth, tourId);
        sendJson(res, 200, { tourId, allocations });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handlePutTransportAllocations(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = (await readJsonBody(req)) as { readonly allocations?: unknown };
    const allocations = Array.isArray(body.allocations) ? body.allocations : [];
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await putTransportAllocations(auth, tourId, allocations as never);
        sendJson(res, 200, { tourId, allocations: result.allocations });
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}
