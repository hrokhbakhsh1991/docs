import { createHash } from "node:crypto";
import type { IWebhookVerifier, ParsedWebhookEvent } from "./webhook-verifier.interface";

/**
 * Dev/test verifier: does **not** validate cryptographic signatures — use only offline.
 * Parses a minimal JSON envelope `{ "id", "type", "paymentId?", "bookingId?" }`.
 */
export class FakeWebhookVerifier implements IWebhookVerifier {
  async verifySignature(
    _headers: Record<string, string | string[] | undefined>,
    _rawBody: Buffer | string
  ): Promise<boolean> {
    return true;
  }

  async parseEvent(rawBody: unknown): Promise<ParsedWebhookEvent> {
    const body = rawBody as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "fake_evt_unknown";
    const type = typeof body.type === "string" ? body.type : "payment.unknown";
    const h = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 24);
    return {
      providerEventId: id,
      type,
      providerPaymentId: typeof body.paymentId === "string" ? body.paymentId : undefined,
      bookingId: typeof body.bookingId === "string" ? body.bookingId : undefined,
      rawPayloadHash: h
    };
  }
}
