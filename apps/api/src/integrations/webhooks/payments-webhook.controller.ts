import type { IncomingMessage, ServerResponse } from "node:http";

import { handleHttpError } from "../../middleware/error-interceptor.ts";
import { parseJsonBody, readRequestBodyRaw, sendJson } from "../../http/json.ts";
import { PaymentsWebhookEventIdRequiredError } from "./payments-webhook-event-id-required.error.ts";
import {
  claimPaymentsWebhookEvent,
} from "./payments-webhook-replay-cache.ts";
import { assertPaymentsWebhookSourceIp } from "./assert-payments-webhook-source-ip.ts";
import { readRequestHeader } from "./read-request-header.ts";
import {
  PAYMENTS_WEBHOOK_EVENT_ID_HEADER,
  PAYMENTS_WEBHOOK_SIGNATURE_HEADER,
  PAYMENTS_WEBHOOK_TIMESTAMP_HEADER,
} from "./webhook.constants.ts";
import { verifyPaymentsWebhookSignature } from "./verify-payments-webhook-signature.ts";

function resolveEventId(req: IncomingMessage, body: unknown): string | null {
  const headerEventId = readRequestHeader(req, PAYMENTS_WEBHOOK_EVENT_ID_HEADER);
  if (headerEventId) {
    return headerEventId;
  }
  if (typeof body === "object" && body !== null && "eventId" in body) {
    const eventId = (body as { eventId?: unknown }).eventId;
    if (typeof eventId === "string" && eventId.trim().length > 0) {
      return eventId.trim();
    }
  }
  return null;
}

/**
 * POST /internal/payments/webhook — PSP ingress (WH-01 + WH-02).
 * Finance side effects land in P5-E.
 */
export async function handlePaymentsWebhook(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const rawBody = await readRequestBodyRaw(req);
    assertPaymentsWebhookSourceIp(req);
    verifyPaymentsWebhookSignature({
      rawBody,
      signatureHeader: readRequestHeader(req, PAYMENTS_WEBHOOK_SIGNATURE_HEADER),
      timestampHeader: readRequestHeader(req, PAYMENTS_WEBHOOK_TIMESTAMP_HEADER),
    });

    const body = parseJsonBody(rawBody);
    const eventId = resolveEventId(req, body);
    if (eventId === null) {
      throw new PaymentsWebhookEventIdRequiredError();
    }

    const claim = claimPaymentsWebhookEvent(eventId);
    if (claim === "replay") {
      sendJson(res, 200, {
        ok: true,
        accepted: false,
        replayed: true,
        eventId,
      });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      accepted: true,
      replayed: false,
      eventId,
    });
  } catch (error) {
    handleHttpError(res, error);
  }
}
