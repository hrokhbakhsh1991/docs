import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { readJsonBody, sendJson } from "../http/json";
import { requireOperatorSession } from "../identity/require-operator-session";
import { handleHttpError } from "../middleware/error-interceptor";
import {
  completeTourExecution,
  getTourExecution,
  startTourExecution,
  updateTourExecutionDriverFact,
} from "./tour-execution.service";

export async function handleGetTourExecution(
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
        const snapshot = await getTourExecution(auth, tourId);
        sendJson(res, 200, { tourId, execution: snapshot?.execution ?? null, driverFacts: snapshot?.driverFacts ?? [] });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleStartTourExecution(
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
        const result = await startTourExecution(auth, tourId);
        sendJson(res, result.replay ? 200 : 201, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleUpdateTourExecutionDriverFact(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
  driverRegistrationId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = (await readJsonBody(req)) as {
      readonly expectedVersion?: unknown;
      readonly actualPassengerCount?: unknown;
      readonly attendanceStatus?: unknown;
      readonly reason?: unknown;
    };
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const fact = await updateTourExecutionDriverFact(auth, tourId, driverRegistrationId, {
          expectedVersion: body.expectedVersion,
          actualPassengerCount: body.actualPassengerCount,
          attendanceStatus: body.attendanceStatus,
          ...(body.reason !== undefined ? { reason: body.reason } : {}),
        });
        sendJson(res, 200, { fact });
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleCompleteTourExecution(
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
        const result = await completeTourExecution(auth, tourId);
        sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}
