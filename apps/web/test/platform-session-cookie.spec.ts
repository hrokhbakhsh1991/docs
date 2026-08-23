import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";

import { SESSION_TOKEN_COOKIE } from "../src/auth/build-session-cookie";
import {
  buildPlatformSessionCookieHeader,
  clearPlatformSessionCookieHeader,
  PLATFORM_SESSION_COOKIE,
  PLATFORM_SESSION_MAX_AGE_SECONDS,
} from "../src/platform/build-platform-session-cookie";
import { requirePlatformOpsSessionWeb } from "../src/platform/require-platform-ops-session";
import { resolveSessionCookieSecure } from "@app-tour/session-client";

describe("requirePlatformOpsSessionWeb", () => {
  it("no session redirect", () => {
    const result = requirePlatformOpsSessionWeb({
      session: null,
      pathname: "/platform/clubs",
    });
    assert.equal(result.allowed, false);
    if (!result.allowed) {
      assert.match(result.redirectTo, /\/auth\/login\?returnUrl=/);
    }
  });

  it("session allowed", () => {
    const result = requirePlatformOpsSessionWeb({
      session: { phone: "+989121234567", role: "owner" },
      pathname: "/platform",
    });
    assert.equal(result.allowed, true);
  });
});

describe("platform session cookie", () => {
  const envSnapshot = {
    NODE_ENV: process.env.NODE_ENV,
    SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE,
  };

  before(() => {
    assert.equal(PLATFORM_SESSION_COOKIE, "platform_session");
    assert.notEqual(PLATFORM_SESSION_COOKIE, SESSION_TOKEN_COOKIE);
  });

  after(() => {
    if (envSnapshot.NODE_ENV === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = envSnapshot.NODE_ENV;
    }
    if (envSnapshot.SESSION_COOKIE_SECURE === undefined) {
      delete process.env.SESSION_COOKIE_SECURE;
    } else {
      process.env.SESSION_COOKIE_SECURE = envSnapshot.SESSION_COOKIE_SECURE;
    }
  });

  afterEach(() => {
    if (envSnapshot.NODE_ENV === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = envSnapshot.NODE_ENV;
    }
    if (envSnapshot.SESSION_COOKIE_SECURE === undefined) {
      delete process.env.SESSION_COOKIE_SECURE;
    } else {
      process.env.SESSION_COOKIE_SECURE = envSnapshot.SESSION_COOKIE_SECURE;
    }
  });

  function setEnv(nodeEnv: string, secureOverride?: string): void {
    process.env.NODE_ENV = nodeEnv;
    if (secureOverride === undefined) {
      delete process.env.SESSION_COOKIE_SECURE;
    } else {
      process.env.SESSION_COOKIE_SECURE = secureOverride;
    }
  }

  function assertCookieBasics(cookie: string): void {
    assert.match(cookie, new RegExp(`^${PLATFORM_SESSION_COOKIE}=`));
    assert.match(cookie, /Path=\//);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.doesNotMatch(cookie, /Domain=/i);
  }

  function assertIssueAndClearAligned(expectedSecure: boolean): void {
    const issue = buildPlatformSessionCookieHeader("platform.jwt.token");
    const clear = clearPlatformSessionCookieHeader();

    assertCookieBasics(issue);
    assertCookieBasics(clear);
    assert.match(issue, new RegExp(`Max-Age=${PLATFORM_SESSION_MAX_AGE_SECONDS}`));
    assert.match(clear, /Max-Age=0/);
    assert.match(clear, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
    assert.equal(issue.includes("Secure"), expectedSecure);
    assert.equal(clear.includes("Secure"), expectedSecure);
    assert.equal(issue.includes("Secure"), clear.includes("Secure"));
  }

  it("SESSION_COOKIE_SECURE=true enables Secure on issue and clear", () => {
    setEnv("development", "true");
    assert.equal(resolveSessionCookieSecure(), true);
    assertIssueAndClearAligned(true);
  });

  it("SESSION_COOKIE_SECURE=false disables Secure on issue and clear", () => {
    setEnv("production", "false");
    assert.equal(resolveSessionCookieSecure(), false);
    assertIssueAndClearAligned(false);
  });

  it("production fallback enables Secure without override", () => {
    setEnv("production");
    assert.equal(resolveSessionCookieSecure(), true);
    assertIssueAndClearAligned(true);
  });

  it("development fallback disables Secure without override", () => {
    setEnv("development");
    assert.equal(resolveSessionCookieSecure(), false);
    assertIssueAndClearAligned(false);
  });

  it("test fallback disables Secure without override", () => {
    setEnv("test");
    assert.equal(resolveSessionCookieSecure(), false);
    assertIssueAndClearAligned(false);
  });
});
