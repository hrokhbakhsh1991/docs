import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { POST } from "../app/api/platform/auth/login/route";

const envSnapshot = {
  PLATFORM_OPS_PHONES: process.env.PLATFORM_OPS_PHONES,
  TOUR_OPS_API_URL: process.env.TOUR_OPS_API_URL,
};
const originalFetch = globalThis.fetch;

function restoreEnv(name: keyof typeof envSnapshot): void {
  const value = envSnapshot[name];
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

function mockVerifyOtp(status: number, payload: Record<string, unknown>): void {
  globalThis.fetch = (async () => Response.json(payload, { status })) as typeof fetch;
}

function loginRequest(): Request {
  return new Request("http://admin.localhost/api/platform/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+989121234567", otp: "1234", challenge_id: "challenge" }),
  });
}

afterEach(() => {
  restoreEnv("PLATFORM_OPS_PHONES");
  restoreEnv("TOUR_OPS_API_URL");
  globalThis.fetch = originalFetch;
});

describe("platform auth BFF", () => {
  it("login sets the HttpOnly platform session cookie without exposing its token in JSON", async () => {
    const platformToken = "header.platform-session.signature";
    process.env.PLATFORM_OPS_PHONES = "+989121234567";
    process.env.TOUR_OPS_API_URL = "http://api.test";
    mockVerifyOtp(200, { platformSessionToken: platformToken, role: "owner" });

    const response = await POST(loginRequest());
    const body = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true, phone: "+989121234567", role: "owner" });
    assert.doesNotMatch(JSON.stringify(body), /platform-session|token|jwt|session/i);
    const setCookie = response.headers.get("Set-Cookie") ?? "";
    assert.match(setCookie, new RegExp(`platform_session=${platformToken}`));
    assert.match(setCookie, /HttpOnly/);
  });

  it("preserves failed OTP verification behavior", async () => {
    process.env.PLATFORM_OPS_PHONES = "+989121234567";
    process.env.TOUR_OPS_API_URL = "http://api.test";
    mockVerifyOtp(401, { code: "OTP_INVALID" });

    const response = await POST(loginRequest());

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: { code: "LOGIN_FAILED", message: "OTP verification failed" },
    });
  });
});
