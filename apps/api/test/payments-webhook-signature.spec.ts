/**
 * P5-D-N-006 — payments webhook HMAC ingress (WH-01)
 * @see docs/phase-18/platform-integrations-plane.mdoc
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, describe, it } from "node:test";

import { createRequestListener } from "../src/app.ts";
import {
  computePaymentsWebhookSignature,
  isPaymentsWebhookSignatureInvalidError,
  isPaymentsWebhookSignatureMissingError,
  isPaymentsWebhookSigningSecretNotConfiguredError,
  isPaymentsWebhookTimestampSkewError,
  PAYMENTS_WEBHOOK_EVENT_ID_HEADER,
  PAYMENTS_WEBHOOK_PATH,
  PAYMENTS_WEBHOOK_SIGNATURE_HEADER,
  PAYMENTS_WEBHOOK_TIMESTAMP_HEADER,
  verifyPaymentsWebhookSignature,
  resetPaymentsWebhookReplayCache,
} from "../src/integrations/webhooks/index.ts";
import { installHttpTestClient } from "./http-test-client.ts";

function signBody(
  secret: string,
  timestampSec: number,
  rawBody: string
): { readonly signature: string; readonly timestamp: string } {
  const timestamp = String(timestampSec);
  return {
    timestamp,
    signature: computePaymentsWebhookSignature(secret, timestamp, rawBody),
  };
}

describe("payments-webhook-signature (P5-D WH-01)", () => {
  const originalSecret = process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET;
    } else {
      process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET = originalSecret;
    }
  });

  it("WH-01 accepts valid HMAC signature within skew window", () => {
    const secret = "whsec_test";
    const rawBody = JSON.stringify({ eventId: "evt_001", provider: "zibal" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    verifyPaymentsWebhookSignature({
      rawBody,
      signatureHeader: computePaymentsWebhookSignature(secret, timestamp, rawBody),
      timestampHeader: timestamp,
      secretOverride: secret,
    });
  });

  it("WH-01b rejects invalid signature (fail-closed)", () => {
    const secret = "whsec_test";
    const rawBody = '{"eventId":"evt_bad"}';
    const timestamp = String(Math.floor(Date.now() / 1000));

    assert.throws(
      () =>
        verifyPaymentsWebhookSignature({
          rawBody,
          signatureHeader: "deadbeef",
          timestampHeader: timestamp,
          secretOverride: secret,
        }),
      (error: unknown) => {
        assert.ok(isPaymentsWebhookSignatureInvalidError(error));
        return true;
      }
    );
  });

  it("WH-01c rejects timestamp outside ±5m skew", () => {
    const secret = "whsec_test";
    const rawBody = '{"eventId":"evt_old"}';
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 600);

    assert.throws(
      () =>
        verifyPaymentsWebhookSignature({
          rawBody,
          signatureHeader: computePaymentsWebhookSignature(secret, staleTimestamp, rawBody),
          timestampHeader: staleTimestamp,
          secretOverride: secret,
        }),
      (error: unknown) => {
        assert.ok(isPaymentsWebhookTimestampSkewError(error));
        return true;
      }
    );
  });

  it("WH-01d rejects missing signature headers", () => {
    assert.throws(
      () =>
        verifyPaymentsWebhookSignature({
          rawBody: "{}",
          signatureHeader: undefined,
          timestampHeader: undefined,
          secretOverride: "whsec_test",
        }),
      (error: unknown) => {
        assert.ok(isPaymentsWebhookSignatureMissingError(error));
        return true;
      }
    );
  });

  it("WH-01e fails closed when signing secret env is missing", () => {
    delete process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET;

    assert.throws(
      () =>
        verifyPaymentsWebhookSignature({
          rawBody: "{}",
          signatureHeader: createHmac("sha256", "x").update("1.{}").digest("hex"),
          timestampHeader: String(Math.floor(Date.now() / 1000)),
        }),
      (error: unknown) => {
        assert.ok(isPaymentsWebhookSigningSecretNotConfiguredError(error));
        return true;
      }
    );
  });
});

describe("payments-webhook route (P5-D WH-01)", () => {
  const originalSecret = process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET;
  const client = installHttpTestClient(() => createRequestListener({}));

  afterEach(() => {
    resetPaymentsWebhookReplayCache();
    if (originalSecret === undefined) {
      delete process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET;
    } else {
      process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET = originalSecret;
    }
  });

  it("WH-01g POST /internal/payments/webhook accepts signed payload", async () => {
    process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET = "whsec_route";
    const body = { eventId: "evt_route_001", status: "paid" };
    const rawBody = JSON.stringify(body);
    const signed = signBody("whsec_route", Math.floor(Date.now() / 1000), rawBody);

    const response = await client.requestJson("POST", PAYMENTS_WEBHOOK_PATH, {
      body,
      headers: {
        [PAYMENTS_WEBHOOK_SIGNATURE_HEADER]: signed.signature,
        [PAYMENTS_WEBHOOK_TIMESTAMP_HEADER]: signed.timestamp,
        [PAYMENTS_WEBHOOK_EVENT_ID_HEADER]: "evt_route_001",
      },
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.accepted, true);
    assert.equal(response.body.replayed, false);
    assert.equal(response.body.eventId, "evt_route_001");
  });

  it("WH-01h route rejects unsigned webhook", async () => {
    process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET = "whsec_route";

    const response = await client.requestJson("POST", PAYMENTS_WEBHOOK_PATH, {
      body: { eventId: "evt_unsigned" },
    });

    assert.equal(response.status, 401);
    assert.equal(response.body.code, "PAYMENTS_WEBHOOK_SIGNATURE_MISSING");
  });
});
