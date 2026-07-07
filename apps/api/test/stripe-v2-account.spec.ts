/**
 * P5-D-N-005 — Stripe Connect Accounts v2 adapter (PSP-02)
 * @see docs/phase-18/platform-integrations-plane.mdoc
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { isEgressUrlBlockedError } from "../src/integrations/egress/index.ts";
import {
  createStripeConnectV2Account,
  createStripeConnectV2AccountLink,
  isStripeSecretKeyNotConfiguredError,
  STRIPE_ACCOUNTS_V2_API_VERSION,
  STRIPE_ACCOUNTS_V2_URL,
  STRIPE_ACCOUNT_LINKS_V2_URL,
} from "../src/integrations/payments/stripe-connect-v2/index.ts";

describe("stripe-v2-account (P5-D PSP-02)", () => {
  const originalSecret = process.env.STRIPE_SECRET_KEY;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = originalSecret;
    }
  });

  it("PSP-02 blocks SSRF return_url before account link fetch", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_mock";
    let fetchCalls = 0;

    await assert.rejects(
      () =>
        createStripeConnectV2AccountLink({
          accountId: "acct_test_001",
          returnUrl: "http://169.254.169.254/return",
          refreshUrl: "https://club.example.test/reauth",
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

  it("PSP-02b creates Accounts v2 account with pinned API version header", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_live";
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: Record<string, unknown> | null = null;

    const result = await createStripeConnectV2Account({
      contactEmail: "owner@club.example.test",
      displayName: "Alpine Club",
      country: "US",
      fetch: async (url, init) => {
        capturedUrl = String(url);
        const rawHeaders = init?.headers;
        if (rawHeaders instanceof Headers) {
          capturedHeaders = Object.fromEntries(rawHeaders.entries());
        } else if (rawHeaders !== undefined && rawHeaders !== null) {
          capturedHeaders = rawHeaders as Record<string, string>;
        }
        capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({ id: "acct_v2_test_001", object: "v2.core.account" }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      },
    });

    assert.equal(capturedUrl, STRIPE_ACCOUNTS_V2_URL);
    assert.equal(
      capturedHeaders.authorization ?? capturedHeaders.Authorization,
      "Bearer sk_test_live"
    );
    assert.equal(
      capturedHeaders["stripe-version"] ?? capturedHeaders["Stripe-Version"],
      STRIPE_ACCOUNTS_V2_API_VERSION
    );
    assert.equal((capturedBody?.identity as { country: string }).country, "us");
    assert.equal(result.accountId, "acct_v2_test_001");
    assert.equal(result.object, "v2.core.account");
  });

  it("PSP-02c creates Accounts v2 onboarding link for connected account", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_live";
    let capturedUrl = "";
    let capturedBody: Record<string, unknown> | null = null;

    const result = await createStripeConnectV2AccountLink({
      accountId: "acct_v2_test_001",
      returnUrl: "https://club.example.test/stripe/return",
      refreshUrl: "https://club.example.test/stripe/reauth",
      fetch: async (url, init) => {
        capturedUrl = String(url);
        capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            object: "v2.core.account_link",
            account: "acct_v2_test_001",
            url: "https://connect.stripe.com/setup/s/acct_v2_test_001",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      },
    });

    assert.equal(capturedUrl, STRIPE_ACCOUNT_LINKS_V2_URL);
    assert.equal(capturedBody?.account, "acct_v2_test_001");
    assert.deepEqual(
      (capturedBody?.use_case as { type: string }).type,
      "account_onboarding"
    );
    assert.equal(result.url, "https://connect.stripe.com/setup/s/acct_v2_test_001");
    assert.equal(result.accountId, "acct_v2_test_001");
  });

  it("PSP-02d fails closed when STRIPE_SECRET_KEY env is missing", async () => {
    delete process.env.STRIPE_SECRET_KEY;

    await assert.rejects(
      () =>
        createStripeConnectV2Account({
          contactEmail: "owner@club.example.test",
          displayName: "Alpine Club",
          country: "US",
          fetch: async () => new Response("{}"),
        }),
      (error: unknown) => {
        assert.ok(isStripeSecretKeyNotConfiguredError(error));
        return true;
      }
    );
  });
});
