import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

describe("session-cookie-secure.spec.ts", () => {
  const envSnapshot = {
    SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE,
    NODE_ENV: process.env.NODE_ENV,
  };

  before(() => {
    process.env.NODE_ENV = "production";
    process.env.SESSION_COOKIE_SECURE = "false";
  });

  after(() => {
    if (envSnapshot.SESSION_COOKIE_SECURE === undefined) {
      delete process.env.SESSION_COOKIE_SECURE;
    } else {
      process.env.SESSION_COOKIE_SECURE = envSnapshot.SESSION_COOKIE_SECURE;
    }
    if (envSnapshot.NODE_ENV === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = envSnapshot.NODE_ENV;
    }
  });

  it("COOKIE-01 SESSION_COOKIE_SECURE=false omits Secure flag on HTTP VPS", async () => {
    const { buildSessionCookieOptions, resolveSessionCookieSecure, setSessionCookieOnResponse } =
      await import("../src/auth/build-session-cookie");
    assert.equal(resolveSessionCookieSecure(), false);
    assert.equal(buildSessionCookieOptions("token").secure, false);

    const headers = new Headers();
    setSessionCookieOnResponse(headers, "token");
    const setCookie = headers.get("set-cookie") ?? "";
    assert.doesNotMatch(setCookie, /;\s*Secure/i);
  });
});
