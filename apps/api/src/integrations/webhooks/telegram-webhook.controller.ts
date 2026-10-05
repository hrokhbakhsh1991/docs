import type { IncomingMessage, ServerResponse } from "node:http";

import { handleHttpError } from "../../middleware/error-interceptor";
import { parseJsonBody, readRequestBodyRaw, sendJson } from "../../http/json";
import { processTelegramWebhook } from "../http/integrations.service";

export async function handleTelegramWebhook(
  req: IncomingMessage,
  res: ServerResponse,
  tenantId: string,
  integrationId: string
): Promise<void> {
  try {
    const rawBody = await readRequestBodyRaw(req);
    const body = parseJsonBody(rawBody);
    const secretHeader = req.headers["x-telegram-bot-api-secret-token"];
    const secret = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;
    const result = await processTelegramWebhook(tenantId, integrationId, secret, body);
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    handleHttpError(res, error);
  }
}
