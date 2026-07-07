/**
 * P5-D-N-004 — Zibal adapter mock suite (PSP-01)
 * @see docs/phase-18/platform-integrations-plane.mdoc
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { isEgressUrlBlockedError } from "../src/integrations/egress/index.ts";
import {
  createZibalPaymentRequest,
  isZibalMerchantNotConfiguredError,
  isZibalPaymentRequestFailedError,
  ZIBAL_REQUEST_URL,
  ZIBAL_SUCCESS_RESULT,
} from "../src/integrations/payments/zibal/index.ts";

describe("zibal-adapter (P5-D PSP-01)", () => {
  const originalMerchant = process.env.ZIBAL_MERCHANT;

  afterEach(() => {
    if (originalMerchant === undefined) {
      delete process.env.ZIBAL_MERCHANT;
    } else {
      process.env.ZIBAL_MERCHANT = originalMerchant;
    }
  });

  it("PSP-01 blocks SSRF callback URL before outbound fetch", async () => {
    process.env.ZIBAL_MERCHANT = "zibal";
    let fetchCalls = 0;

    await assert.rejects(
      () =>
        createZibalPaymentRequest({
          amountMinor: 160_000,
          callbackUrl: "http://127.0.0.1/callback",
          orderId: "ord-ssrf",
          tenantId: "tenant-a",
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

  it("PSP-01b posts JSON to gateway.zibal.ir/v1/request with env merchant", async () => {
    process.env.ZIBAL_MERCHANT = "merchant-live";
    let capturedUrl = "";
    let capturedBody: Record<string, unknown> | null = null;

    const result = await createZibalPaymentRequest({
      amountMinor: 250_000,
      callbackUrl: "https://club.example.test/payments/zibal/callback",
      orderId: "ord-1001",
      tenantId: "tenant-b",
      description: "Tour registration",
      fetch: async (url, init) => {
        capturedUrl = String(url);
        capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({ result: ZIBAL_SUCCESS_RESULT, trackId: "998877" }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      },
    });

    assert.equal(capturedUrl, ZIBAL_REQUEST_URL);
    assert.deepEqual(capturedBody, {
      merchant: "merchant-live",
      amount: 250_000,
      callbackUrl: "https://club.example.test/payments/zibal/callback",
      orderId: "ord-1001",
      description: "Tour registration",
    });
    assert.equal(result.trackId, "998877");
    assert.equal(result.redirectUrl, "https://gateway.zibal.ir/start/998877");
    assert.equal(result.result, ZIBAL_SUCCESS_RESULT);
  });

  it("PSP-01c throws when Zibal API returns non-success result", async () => {
    process.env.ZIBAL_MERCHANT = "zibal";

    await assert.rejects(
      () =>
        createZibalPaymentRequest({
          amountMinor: 10_000,
          callbackUrl: "https://club.example.test/callback",
          orderId: "ord-fail",
          tenantId: "tenant-c",
          fetch: async () =>
            new Response(JSON.stringify({ result: 102, message: "merchant invalid" }), {
              status: 200,
              headers: { "content-type": "application/json" },
            }),
        }),
      (error: unknown) => {
        assert.ok(isZibalPaymentRequestFailedError(error));
        assert.equal(error.result, 102);
        return true;
      }
    );
  });

  it("PSP-01d fails closed when ZIBAL_MERCHANT env is missing", async () => {
    delete process.env.ZIBAL_MERCHANT;

    await assert.rejects(
      () =>
        createZibalPaymentRequest({
          amountMinor: 10_000,
          callbackUrl: "https://club.example.test/callback",
          orderId: "ord-no-merchant",
          tenantId: "tenant-d",
          fetch: async () => new Response("{}"),
        }),
      (error: unknown) => {
        assert.ok(isZibalMerchantNotConfiguredError(error));
        return true;
      }
    );
  });
});
