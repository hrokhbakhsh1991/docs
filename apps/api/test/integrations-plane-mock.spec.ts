/**
 * P5-D-N-009 — integrations plane mock suite (INT-01)
 * Runtime chain: egress → Zibal → Stripe v2 → signed webhook + replay.
 * @see docs/phase-18/platform-integrations-plane.mdoc
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { assertSafeOutboundUrl, isEgressUrlBlockedError } from "../src/integrations/egress/index.ts";
import {
  createStripeConnectV2Account,
  createStripeConnectV2AccountLink,
} from "../src/integrations/payments/stripe-connect-v2/index.ts";
import {
  createZibalPaymentRequest,
  ZIBAL_SUCCESS_RESULT,
} from "../src/integrations/payments/zibal/index.ts";
import {
  computePaymentsWebhookSignature,
  PAYMENTS_WEBHOOK_EVENT_ID_HEADER,
  PAYMENTS_WEBHOOK_PATH,
  PAYMENTS_WEBHOOK_SIGNATURE_HEADER,
  PAYMENTS_WEBHOOK_TIMESTAMP_HEADER,
  resetPaymentsWebhookReplayCache,
} from "../src/integrations/webhooks/index.ts";
import { createRequestListener } from "../src/app.ts";
import {
  assertWorkspaceCommerceGatewayActivationAllowed,
  isWorkspaceCommerceGatewayBlockedError,
} from "../src/workspace-metadata/assert-workspace-commerce-gateway-blocked.ts";
import { installHttpTestClient } from "./http-test-client.ts";

function signWebhook(
  secret: string,
  body: Record<string, unknown>
): Record<string, string> {
  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  return {
    [PAYMENTS_WEBHOOK_SIGNATURE_HEADER]: computePaymentsWebhookSignature(
      secret,
      timestamp,
      rawBody
    ),
    [PAYMENTS_WEBHOOK_TIMESTAMP_HEADER]: timestamp,
    ...(typeof body.eventId === "string"
      ? { [PAYMENTS_WEBHOOK_EVENT_ID_HEADER]: body.eventId }
      : {}),
  };
}

describe("integrations-plane-mock (P5-D INT-01)", () => {
  const envSnapshot = {
    zibal: process.env.ZIBAL_MERCHANT,
    stripe: process.env.STRIPE_SECRET_KEY,
    webhook: process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET,
    gatewayLift: process.env.P5_D_GATEWAY_ACTIVATION_ENABLED,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries({
      ZIBAL_MERCHANT: envSnapshot.zibal,
      STRIPE_SECRET_KEY: envSnapshot.stripe,
      PAYMENTS_WEBHOOK_SIGNING_SECRET: envSnapshot.webhook,
      P5_D_GATEWAY_ACTIVATION_ENABLED: envSnapshot.gatewayLift,
    })) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    resetPaymentsWebhookReplayCache();
  });

  it("INT-01 mock chain: Zibal request + Stripe v2 onboarding link", async () => {
    process.env.ZIBAL_MERCHANT = "zibal";
    process.env.STRIPE_SECRET_KEY = "sk_test_int01";

    const zibal = await createZibalPaymentRequest({
      amountMinor: 120_000,
      callbackUrl: "https://club.example.test/payments/zibal/callback",
      orderId: "int01-zibal",
      tenantId: "tenant-int01",
      fetch: async () =>
        new Response(JSON.stringify({ result: ZIBAL_SUCCESS_RESULT, trackId: "881122" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    assert.equal(zibal.trackId, "881122");

    const account = await createStripeConnectV2Account({
      contactEmail: "owner@club.example.test",
      displayName: "INT01 Club",
      country: "US",
      fetch: async () =>
        new Response(JSON.stringify({ id: "acct_int01", object: "v2.core.account" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    });
    assert.equal(account.accountId, "acct_int01");

    const link = await createStripeConnectV2AccountLink({
      accountId: account.accountId,
      returnUrl: "https://club.example.test/stripe/return",
      refreshUrl: "https://club.example.test/stripe/reauth",
      fetch: async () =>
        new Response(
          JSON.stringify({
            object: "v2.core.account_link",
            account: "acct_int01",
            url: "https://connect.stripe.com/setup/s/acct_int01",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        ),
    });
    assert.match(link.url, /connect\.stripe\.com/);
  });

  it("INT-01b egress guard blocks SSRF callback in mock Zibal path", async () => {
    process.env.ZIBAL_MERCHANT = "zibal";
    let fetchCalls = 0;

    await assert.rejects(
      () =>
        createZibalPaymentRequest({
          amountMinor: 10_000,
          callbackUrl: "http://127.0.0.1/hook",
          orderId: "int01-ssrf",
          tenantId: "tenant-int01",
          fetch: async () => {
            fetchCalls += 1;
            return new Response("{}");
          },
        }),
      (error: unknown) => {
        assert.ok(isEgressUrlBlockedError(error));
        return true;
      }
    );
    assert.equal(fetchCalls, 0);
  });

  it("INT-01c public egress allowlist accepts PSP hosts used by adapters", () => {
    assert.equal(
      assertSafeOutboundUrl({
        url: "https://gateway.zibal.ir/v1/request",
        allowedHosts: ["gateway.zibal.ir"],
      }).hostname,
      "gateway.zibal.ir"
    );
    assert.equal(
      assertSafeOutboundUrl({
        url: "https://api.stripe.com/v2/core/accounts",
        allowedHosts: ["api.stripe.com"],
      }).hostname,
      "api.stripe.com"
    );
  });
});

describe("integrations-plane-mock webhook replay (P5-D INT-01d)", () => {
  const originalSecret = process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET;
  const client = installHttpTestClient(() => createRequestListener({}));

  beforeEach(() => {
    resetPaymentsWebhookReplayCache();
    process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET = "whsec_int01_replay";
  });

  afterEach(() => {
    resetPaymentsWebhookReplayCache();
    if (originalSecret === undefined) {
      delete process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET;
    } else {
      process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET = originalSecret;
    }
  });

  it("INT-01d signed webhook duplicate returns replay noop in mock route", async () => {
    const body = { eventId: "evt_int01_replay", status: "paid" };
    const headers = signWebhook("whsec_int01_replay", body);

    const first = await client.requestJson("POST", PAYMENTS_WEBHOOK_PATH, { body, headers });
    const second = await client.requestJson("POST", PAYMENTS_WEBHOOK_PATH, { body, headers });

    assert.equal(first.status, 200);
    assert.equal(first.body.accepted, true);
    assert.equal(second.status, 200);
    assert.equal(second.body.replayed, true);
    assert.equal(second.body.accepted, false);
  });
});

describe("integrations-plane-mock GU-02 lift (P5-D INT-01e)", () => {
  const originalLift = process.env.P5_D_GATEWAY_ACTIVATION_ENABLED;

  afterEach(() => {
    if (originalLift === undefined) {
      delete process.env.P5_D_GATEWAY_ACTIVATION_ENABLED;
    } else {
      process.env.P5_D_GATEWAY_ACTIVATION_ENABLED = originalLift;
    }
  });

  it("INT-01e gateway commerce blocked by default", () => {
    delete process.env.P5_D_GATEWAY_ACTIVATION_ENABLED;
    assert.throws(
      () => assertWorkspaceCommerceGatewayActivationAllowed({ paymentMode: "gateway" }),
      (error: unknown) => {
        assert.ok(isWorkspaceCommerceGatewayBlockedError(error));
        return true;
      }
    );
  });

  it("INT-01f gateway commerce allowed when P5_D_GATEWAY_ACTIVATION_ENABLED=true", () => {
    process.env.P5_D_GATEWAY_ACTIVATION_ENABLED = "true";
    assert.doesNotThrow(() =>
      assertWorkspaceCommerceGatewayActivationAllowed({ paymentMode: "gateway" })
    );
  });
});
