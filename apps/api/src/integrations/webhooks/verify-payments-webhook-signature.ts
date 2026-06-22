import { createHmac, timingSafeEqual } from "node:crypto";

import { PAYMENTS_WEBHOOK_MAX_SKEW_MS } from "./webhook.constants.ts";
import {
  PaymentsWebhookSignatureInvalidError,
  PaymentsWebhookSignatureMissingError,
  PaymentsWebhookTimestampSkewError,
} from "./webhook.errors.ts";
import { resolvePaymentsWebhookSigningSecret } from "./resolve-payments-webhook-signing-secret.ts";

export type VerifyPaymentsWebhookSignatureInput = {
  readonly rawBody: string;
  readonly signatureHeader: string | undefined;
  readonly timestampHeader: string | undefined;
  readonly secretOverride?: string;
  readonly nowMs?: number;
};

export function buildPaymentsWebhookSignedPayload(
  timestamp: string,
  rawBody: string
): string {
  return `${timestamp}.${rawBody}`;
}

export function computePaymentsWebhookSignature(
  secret: string,
  timestamp: string,
  rawBody: string
): string {
  return createHmac("sha256", secret)
    .update(buildPaymentsWebhookSignedPayload(timestamp, rawBody))
    .digest("hex");
}

function normalizeSignatureHeader(value: string): string {
  const trimmed = value.trim();
  const sha256Prefix = "sha256=";
  if (trimmed.toLowerCase().startsWith(sha256Prefix)) {
    return trimmed.slice(sha256Prefix.length).trim();
  }
  return trimmed;
}

function assertTimestampSkew(timestampHeader: string, nowMs: number): void {
  const timestampSec = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(timestampSec) || timestampSec <= 0) {
    throw new PaymentsWebhookTimestampSkewError();
  }
  const deltaMs = Math.abs(nowMs - timestampSec * 1000);
  if (deltaMs > PAYMENTS_WEBHOOK_MAX_SKEW_MS) {
    throw new PaymentsWebhookTimestampSkewError();
  }
}

function assertSignatureMatch(expectedHex: string, providedHeader: string): void {
  const providedHex = normalizeSignatureHeader(providedHeader);
  const expected = Buffer.from(expectedHex, "hex");
  const provided = Buffer.from(providedHex, "hex");
  if (expected.length === 0 || provided.length === 0 || expected.length !== provided.length) {
    throw new PaymentsWebhookSignatureInvalidError();
  }
  if (!timingSafeEqual(expected, provided)) {
    throw new PaymentsWebhookSignatureInvalidError();
  }
}

/**
 * P5-D-N-006 — WH-01 HMAC-SHA256 + ±5m timestamp skew (fail-closed).
 */
export function verifyPaymentsWebhookSignature(
  input: VerifyPaymentsWebhookSignatureInput
): void {
  if (!input.signatureHeader || !input.timestampHeader) {
    throw new PaymentsWebhookSignatureMissingError();
  }

  const nowMs = input.nowMs ?? Date.now();
  assertTimestampSkew(input.timestampHeader, nowMs);

  const secret = resolvePaymentsWebhookSigningSecret(input.secretOverride);
  const expected = computePaymentsWebhookSignature(
    secret,
    input.timestampHeader,
    input.rawBody
  );
  assertSignatureMatch(expected, input.signatureHeader);
}
