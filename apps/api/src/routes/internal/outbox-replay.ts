import type { IncomingMessage, ServerResponse } from "node:http";

import { readJsonBody, sendJson } from "../../http/json";
import { handleHttpError } from "../../middleware/error-interceptor";
import { replayFailedOutboxEvent } from "../../outbox/outbox-replay";

type ReplayBody = {
  readonly tenantId?: unknown;
};

function parseReplayBody(raw: unknown): { tenantId: string } {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("OUTBOX_REPLAY_BODY_INVALID");
  }
  const body = raw as ReplayBody;
  if (typeof body.tenantId !== "string" || body.tenantId.trim().length === 0) {
    throw new Error("OUTBOX_REPLAY_TENANT_ID_REQUIRED");
  }
  return { tenantId: body.tenantId.trim() };
}

/**
 * POST /internal/outbox/:id/replay — development/non-production only (DEC-086).
 */
export async function handleReplayOutbox(
  req: IncomingMessage,
  res: ServerResponse,
  outboxId: string
): Promise<void> {
  try {
    const rawBody = await readJsonBody<unknown>(req);
    const body = parseReplayBody(rawBody);
    await replayFailedOutboxEvent({ tenantId: body.tenantId, outboxId });
    sendJson(res, 200, { id: outboxId, status: "pending" });
  } catch (error) {
    handleHttpError(res, error);
  }
}
