import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SESSION_TOKEN_COOKIE } from "../src/auth/build-session-cookie";

describe("portal build-session-cookie — P8-1-N-001", () => {
  it("P8-SES-01 member cookie name is atour_mb_session", () => {
    assert.equal(SESSION_TOKEN_COOKIE, "atour_mb_session");
  });

  it("P8-SES-02 differs from operator web cookie name", async () => {
    const { SESSION_TOKEN_COOKIE: operatorCookie } = await import(
      "../../web/src/auth/build-session-cookie"
    );
    assert.notEqual(SESSION_TOKEN_COOKIE, operatorCookie);
    assert.equal(operatorCookie, "atour_op_session");
  });

  it("P8-1-N-004 SESSION_COOKIE_SECURE=false on Profile B HTTP", async () => {
    const { resolveSessionCookieSecure, buildSessionCookieOptions } = await import(
      "../src/auth/build-session-cookie"
    );
    const prior = process.env.SESSION_COOKIE_SECURE;
    const priorNode = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    process.env.SESSION_COOKIE_SECURE = "false";
    try {
      assert.equal(resolveSessionCookieSecure(), false);
      assert.equal(buildSessionCookieOptions("t").secure, false);
    } finally {
      if (prior === undefined) delete process.env.SESSION_COOKIE_SECURE;
      else process.env.SESSION_COOKIE_SECURE = prior;
      if (priorNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = priorNode;
    }
  });

  it("PCMS-COOK-05 custom apex host sets Domain on Set-Cookie", async () => {
    const { setSessionCookieOnResponse, resolveMemberSessionCookieDomainForHost } = await import(
      "../src/auth/build-session-cookie"
    );
    assert.equal(resolveMemberSessionCookieDomainForHost("portal.denali.club:3003"), "denali.club");
    const headers = new Headers();
    setSessionCookieOnResponse(headers, "jwt-token", "portal.denali.club:3003");
    const setCookie = headers.get("set-cookie") ?? "";
    assert.match(setCookie, /Domain=denali\.club/);
  });
});
