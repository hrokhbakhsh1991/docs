import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { readJsonBody } from "../http/json";
import { sendJson } from "../http/json";
import { handleHttpError } from "../middleware/error-interceptor";
import { requireOperatorSession } from "../identity/require-operator-session";
import {
  completeDriverPayable,
  listDriverPayablesForTenant,
} from "../settlement/driver-settlement.service.ts";

export async function handleListDriverPayables(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const payables = await listDriverPayablesForTenant(auth);
        sendJson(res, 200, { payables });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleCompleteDriverPayable(
  req: IncomingMessage,
  res: ServerResponse,
  payableId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = (await readJsonBody(req)) as {
      readonly evidenceNote?: string;
      readonly evidenceFileKey?: string;
    };
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await completeDriverPayable(auth, payableId, body);
        sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}
