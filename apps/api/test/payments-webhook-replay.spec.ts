/**
 * P5-D-N-007 — payments webhook replay cache (WH-02)
 * @see docs/phase-18/platform-integrations-plane.mdoc
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { createRequestListener } from "../src/app.ts";
import {
  claimPaymentsWebhookEvent,
  computePaymentsWebhookSignature,
  PAYMENTS_WEBHOOK_EVENT_ID_HEADER,
  PAYMENTS_WEBHOOK_PATH,
  PAYMENTS_WEBHOOK_SIGNATURE_HEADER,
  PAYMENTS_WEBHOOK_TIMESTAMP_HEADER,
  resetPaymentsWebhookReplayCache,
} from "../src/integrations/webhooks/index.ts";
import { installHttpTestClient } from "./http-test-client.ts";

function signWebhook(
  secret: string,
  body: Record<string, unknown>
): { readonly rawBody: string; readonly headers: Record<string, string> } {
  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  return {
    rawBody,
    headers: {
      [PAYMENTS_WEBHOOK_SIGNATURE_HEADER]: computePaymentsWebhookSignature(
        secret,
        timestamp,
        rawBody
      ),
      [PAYMENTS_WEBHOOK_TIMESTAMP_HEADER]: timestamp,
      ...(typeof body.eventId === "string"
        ? { [PAYMENTS_WEBHOOK_EVENT_ID_HEADER]: body.eventId }
        : {}),
    },
  };
}

describe("payments-webhook-replay-cache (P5-D WH-02 unit)", () => {
  beforeEach(() => {
    resetPaymentsWebhookReplayCache();
  });

  it("WH-02a first claim is fresh", () => {
    assert.equal(claimPaymentsWebhookEvent("evt_fresh"), "fresh");
  });

  it("WH-02b second claim within TTL is replay", () => {
    assert.equal(claimPaymentsWebhookEvent("evt_dup", { nowMs: 1_000, ttlMs: 10_000 }), "fresh");
    assert.equal(claimPaymentsWebhookEvent("evt_dup", { nowMs: 2_000, ttlMs: 10_000 }), "replay");
  });

  it("WH-02c claim after TTL expires is fresh again", () => {
    assert.equal(claimPaymentsWebhookEvent("evt_ttl", { nowMs: 1_000, ttlMs: 5_000 }), "fresh");
    assert.equal(claimPaymentsWebhookEvent("evt_ttl", { nowMs: 3_000, ttlMs: 5_000 }), "replay");
    assert.equal(claimPaymentsWebhookEvent("evt_ttl", { nowMs: 7_000, ttlMs: 5_000 }), "fresh");
  });
});

describe("payments-webhook-replay route (P5-D WH-02)", () => {
  const originalSecret = process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET;
  const client = installHttpTestClient(() => createRequestListener({}));

  beforeEach(() => {
    resetPaymentsWebhookReplayCache();
  });

  afterEach(() => {
    resetPaymentsWebhookReplayCache();
    if (originalSecret === undefined) {
      delete process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET;
    } else {
      process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET = originalSecret;
    }
  });

  it("WH-02d first signed delivery accepted, duplicate returns replay noop", async () => {
    process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET = "whsec_replay";
    const body = { eventId: "evt_route_replay", status: "paid" };
    const signed = signWebhook("whsec_replay", body);

    const first = await client.requestJson("POST", PAYMENTS_WEBHOOK_PATH, {
      body,
      headers: signed.headers,
    });
    assert.equal(first.status, 200);
    assert.equal(first.body.accepted, true);
    assert.equal(first.body.replayed, false);

    const second = await client.requestJson("POST", PAYMENTS_WEBHOOK_PATH, {
      body,
      headers: signed.headers,
    });
    assert.equal(second.status, 200);
    assert.equal(second.body.accepted, false);
    assert.equal(second.body.replayed, true);
    assert.equal(second.body.eventId, "evt_route_replay");
  });

  it("WH-02e distinct eventIds both accepted", async () => {
    process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET = "whsec_replay";

    for (const eventId of ["evt_a", "evt_b"]) {
      const body = { eventId, status: "paid" };
      const response = await client.requestJson("POST", PAYMENTS_WEBHOOK_PATH, {
        body,
        headers: signWebhook("whsec_replay", body).headers,
      });
      assert.equal(response.status, 200);
      assert.equal(response.body.accepted, true);
      assert.equal(response.body.replayed, false);
    }
  });

  it("WH-02f signed webhook without eventId returns 400", async () => {
    process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET = "whsec_replay";
    const body = { status: "paid" };
    const signed = signWebhook("whsec_replay", body);

    const response = await client.requestJson("POST", PAYMENTS_WEBHOOK_PATH, {
      body,
      headers: signed.headers,
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.code, "PAYMENTS_WEBHOOK_EVENT_ID_REQUIRED");
  });
});
