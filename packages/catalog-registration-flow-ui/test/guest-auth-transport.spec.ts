import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  createPortalSameOriginGuestAuthTransport,
  tryCreatePortalOriginGuestAuthTransport,
  createPortalOriginGuestAuthTransport,
  GuestAuthTransportError,
  isGuestAuthTransportError,
  readGuestAuthFailureCode,
} from "../src/guest-auth-transport.ts";

describe("createPortalSameOriginGuestAuthTransport", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("posts relative public-auth paths with credentials include", async () => {
    const calls: Array<{ readonly url: string; readonly init: RequestInit }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response(JSON.stringify({ ok: true, exists: true, challenge_id: "ch-1" }), {
        status: 200,
      });
    }) as typeof fetch;

    const transport = createPortalSameOriginGuestAuthTransport();
    const preflight = await transport.preflightPhone({ phone: "+989121111111" });
    const otp = await transport.requestOtp({ phone: "+989121111111" });

    assert.equal(preflight.exists, true);
    assert.equal(otp.challengeId, "ch-1");
    assert.equal(calls[0]?.url, "/api/public-auth/phone-preflight");
    assert.equal(calls[1]?.url, "/api/public-auth/request-otp");
    assert.equal(calls[0]?.init.credentials, "include");
    assert.equal(calls[1]?.init.method, "POST");
  });

  it("verifyOtp returns needs_profile when registration is required", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          ok: true,
          requires_registration: true,
          onboarding_token: "onb-1",
        }),
        { status: 200 }
      )) as typeof fetch;

    const transport = createPortalSameOriginGuestAuthTransport();
    const result = await transport.verifyOtp({
      phone: "+989121111111",
      otp: "1234",
      challengeId: "ch-1",
    });
    assert.deepEqual(result, { outcome: "needs_profile", onboardingToken: "onb-1" });
  });

  it("verifyOtp returns session_ready for existing members", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch;

    const transport = createPortalSameOriginGuestAuthTransport();
    const result = await transport.verifyOtp({
      phone: "+989121111111",
      otp: "1234",
      challengeId: "ch-1",
    });
    assert.deepEqual(result, { outcome: "session_ready" });
  });

  it("completeProfile posts register-complete and maps API errors", async () => {
    globalThis.fetch = (async (input) => {
      assert.equal(String(input), "/api/public-auth/register-complete");
      return new Response(JSON.stringify({ error: { code: "DISPLAY_NAME_REQUIRED" } }), {
        status: 400,
      });
    }) as typeof fetch;

    const transport = createPortalSameOriginGuestAuthTransport();
    await assert.rejects(
      () =>
        transport.completeProfile({
          onboardingToken: "onb-1",
          displayName: "",
        }),
      (error: unknown) => {
        assert.equal(isGuestAuthTransportError(error), true);
        assert.ok(error instanceof GuestAuthTransportError);
        assert.equal(error.code, "DISPLAY_NAME_REQUIRED");
        assert.equal(readGuestAuthFailureCode(error), "DISPLAY_NAME_REQUIRED");
        return true;
      }
    );
  });

  it("probeSession uses GET /api/me/profile", async () => {
    const urls: string[] = [];
    globalThis.fetch = (async (input, init) => {
      urls.push(String(input));
      assert.equal(init?.method, "GET");
      assert.equal(init?.credentials, "include");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;

    const transport = createPortalSameOriginGuestAuthTransport();
    const result = await transport.probeSession();
    assert.equal(result.ready, true);
    assert.equal(urls[0], "/api/me/profile");
  });

  it("factory source does not accept a base URL", () => {
    assert.equal(createPortalSameOriginGuestAuthTransport.length, 0);
  });
});

describe("tryCreatePortalOriginGuestAuthTransport", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("posts absolute portal public-auth paths with credentials include", async () => {
    const calls: Array<{ readonly url: string; readonly init: RequestInit }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init: init ?? {} });
      return new Response(JSON.stringify({ ok: true, exists: true, challenge_id: "ch-1" }), {
        status: 200,
      });
    }) as typeof fetch;

    const transport = tryCreatePortalOriginGuestAuthTransport("https://portal.denali.club:3003/extra");
    assert.ok(transport);
    const preflight = await transport.preflightPhone({ phone: "+989121111111" });
    const otp = await transport.requestOtp({ phone: "+989121111111" });

    assert.equal(preflight.exists, true);
    assert.equal(otp.challengeId, "ch-1");
    assert.equal(calls[0]?.url, "https://portal.denali.club:3003/api/public-auth/phone-preflight");
    assert.equal(calls[1]?.url, "https://portal.denali.club:3003/api/public-auth/request-otp");
    assert.equal(calls[0]?.init.credentials, "include");
    assert.equal(calls[1]?.init.method, "POST");
  });

  it("probeSession uses GET /api/public-auth/session and never /api/me/profile", async () => {
    const urls: string[] = [];
    globalThis.fetch = (async (input, init) => {
      urls.push(String(input));
      assert.equal(init?.method, "GET");
      assert.equal(init?.credentials, "include");
      return new Response(JSON.stringify({ ok: true, ready: true }), { status: 200 });
    }) as typeof fetch;

    const transport = createPortalOriginGuestAuthTransport("http://portal.denali.localhost:3003");
    const result = await transport.probeSession();
    assert.equal(result.ready, true);
    assert.equal(urls[0], "http://portal.denali.localhost:3003/api/public-auth/session");
    assert.equal(
      urls.some((url) => url.includes("/api/me/profile")),
      false
    );
  });

  it("verifyOtp ignores JSON session_token", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: true, session_token: "must-not-persist" }), {
        status: 200,
      })) as typeof fetch;

    const transport = createPortalOriginGuestAuthTransport("https://portal.example.com");
    const result = await transport.verifyOtp({
      phone: "+989121111111",
      otp: "1234",
      challengeId: "ch-1",
    });
    assert.deepEqual(result, { outcome: "session_ready" });
  });

  it("returns null for invalid origins and create throws network", () => {
    assert.equal(tryCreatePortalOriginGuestAuthTransport(null), null);
    assert.equal(tryCreatePortalOriginGuestAuthTransport(""), null);
    assert.equal(tryCreatePortalOriginGuestAuthTransport("*"), null);
    assert.equal(tryCreatePortalOriginGuestAuthTransport("/portal"), null);
    assert.equal(tryCreatePortalOriginGuestAuthTransport("ftp://portal.example.com"), null);
    assert.equal(tryCreatePortalOriginGuestAuthTransport("https://user:pass@portal.example.com"), null);
    assert.throws(
      () => createPortalOriginGuestAuthTransport("*"),
      (error: unknown) => {
        assert.equal(isGuestAuthTransportError(error), true);
        assert.ok(error instanceof GuestAuthTransportError);
        assert.equal(error.code, "network");
        return true;
      }
    );
  });
});
