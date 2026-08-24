/**
 * DP1-I — HTTP routes for payment hold operator actions.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

import { sendJson } from "../http/json.ts";
import { handleHttpError } from "../middleware/error-interceptor.ts";
import { requireOperatorSession } from "../identity/require-operator-session.ts";
import { extendPaymentHoldDeadline } from "./payment-hold-extend.ts";

export async function handleExtendPaymentHold(
  req: IncomingMessage,
  res: ServerResponse,
  registrationId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = (await readJsonBody(req)) as { newDueAt?: string };
    if (typeof body.newDueAt !== "string" || body.newDueAt.trim().length === 0) {
      sendJson(res, 400, { code: "INVALID_PAYLOAD" });
      return;
    }
    const result = await extendPaymentHoldDeadline({
      tenantId: auth.tenantId,
      registrationId,
      newDueAt: body.newDueAt,
      actorUserId: auth.userId,
    });
    sendJson(res, 200, result);
  } catch (error) {
    handleHttpError(res, error);
  }
}

export function registerPaymentHoldHttpRoutes(
  router: {
    post(
      path: string,
      handler: (req: IncomingMessage, res: ServerResponse, registrationId: string) => Promise<void>
    ): void;
  }
): void {
  router.post(
    "/finance/payment-holds/:registrationId/extend",
    (req, res, registrationId) => handleExtendPaymentHold(req, res, registrationId)
  );
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (raw.length === 0) {
    return {};
  }
  return JSON.parse(raw) as unknown;
}
