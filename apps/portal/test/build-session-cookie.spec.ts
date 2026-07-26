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

  it("PCMS-COOK-06 dev denali.portal.localhost auth BFF is host-only", async () => {
    const priorNode = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const { setSessionCookieOnResponse } = await import("../src/auth/build-session-cookie");
      const headers = new Headers();
      setSessionCookieOnResponse(headers, "jwt-token", "denali.portal.localhost:3003");
      const setCookie = headers.get("set-cookie") ?? "";
      assert.doesNotMatch(setCookie, /Domain=/);
    } finally {
      if (priorNode === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = priorNode;
      }
    }
  });

  it("PCMS-COOK-06b shared refresh on legacy *.portal.localhost stays host-only (never Domain=.localhost)", async () => {
    const priorNode = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const {
        setSessionCookieOnResponse,
        shouldRefreshDevMemberSessionCookieDomain,
      } = await import("../src/auth/build-session-cookie");
      assert.equal(shouldRefreshDevMemberSessionCookieDomain("denali.portal.localhost:3003"), false);
      const headers = new Headers();
      setSessionCookieOnResponse(headers, "jwt-token", "denali.portal.localhost:3003", "shared");
      const setCookie = headers.get("set-cookie") ?? "";
      assert.doesNotMatch(setCookie, /Domain=/);
      assert.doesNotMatch(setCookie, /Domain=\.localhost/i);
    } finally {
      if (priorNode === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = priorNode;
      }
    }
  });

  it("PCMS-COOK-06c inverted portal.denali.localhost sets Domain=denali.localhost", async () => {
    const { setSessionCookieOnResponse, shouldRefreshDevMemberSessionCookieDomain } = await import(
      "../src/auth/build-session-cookie"
    );
    assert.equal(shouldRefreshDevMemberSessionCookieDomain("portal.denali.localhost:3003"), true);
    const headers = new Headers();
    setSessionCookieOnResponse(headers, "jwt-token", "portal.denali.localhost:3003");
    assert.match(headers.get("set-cookie") ?? "", /Domain=denali\.localhost/);
  });

  it("PCMS-COOK-08 shared refresh on marketing localhost ingress stays host-only", async () => {
    const priorNode = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const {
        setSessionCookieOnResponse,
        shouldRefreshDevMemberSessionCookieDomain,
      } = await import("../src/auth/build-session-cookie");
      assert.equal(shouldRefreshDevMemberSessionCookieDomain("denali.localhost:3002"), false);
      const headers = new Headers();
      setSessionCookieOnResponse(headers, "jwt-token", "denali.localhost:3002", "shared");
      const setCookie = headers.get("set-cookie") ?? "";
      assert.doesNotMatch(setCookie, /Domain=/);
    } finally {
      if (priorNode === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = priorNode;
      }
    }
  });

  it("PCMS-COOK-08b apex shared refresh re-issues Domain=denali.club", async () => {
    const {
      setSessionCookieOnResponse,
      shouldRefreshDevMemberSessionCookieDomain,
    } = await import("../src/auth/build-session-cookie");
    assert.equal(shouldRefreshDevMemberSessionCookieDomain("portal.denali.club:3003"), true);
    const headers = new Headers();
    setSessionCookieOnResponse(headers, "jwt-token", "portal.denali.club:3003", "shared");
    assert.match(headers.get("set-cookie") ?? "", /Domain=denali\.club/);
  });

  it("PCMS-COOK-09 platform prod ingress stays host-only (no localhost widening)", async () => {
    const priorNode = process.env.NODE_ENV;
    const priorRoot = process.env.PLATFORM_ROOT_DOMAIN;
    process.env.NODE_ENV = "production";
    process.env.PLATFORM_ROOT_DOMAIN = "example.com";
    try {
      const { setSessionCookieOnResponse } = await import("../src/auth/build-session-cookie");
      const headers = new Headers();
      setSessionCookieOnResponse(headers, "jwt-token", "denali.portal.example.com:3003");
      const setCookie = headers.get("set-cookie") ?? "";
      assert.doesNotMatch(setCookie, /Domain=/);
    } finally {
      if (priorNode === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = priorNode;
      }
      if (priorRoot === undefined) {
        delete process.env.PLATFORM_ROOT_DOMAIN;
      } else {
        process.env.PLATFORM_ROOT_DOMAIN = priorRoot;
      }
    }
  });

  it("PCMS-COOK-07 logout on *.localhost clears host-only only", async () => {
    const priorNode = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const { clearSessionCookieOnResponse, SESSION_TOKEN_COOKIE } = await import(
        "../src/auth/build-session-cookie"
      );
      const headers = new Headers();
      clearSessionCookieOnResponse(headers, "denali.portal.localhost:3003");
      const setCookies = headers.getSetCookie();
      assert.equal(setCookies.length, 1);
      assert.ok(setCookies[0]?.includes(`${SESSION_TOKEN_COOKIE}=`));
      assert.ok(/Max-Age=0/i.test(setCookies[0] ?? ""));
      assert.ok(!/Domain=/i.test(setCookies[0] ?? ""));
    } finally {
      if (priorNode === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = priorNode;
      }
    }
  });

  it("PCMS-COOK-07b logout on custom apex clears host-only and Domain=apex", async () => {
    const { clearSessionCookieOnResponse, SESSION_TOKEN_COOKIE } = await import(
      "../src/auth/build-session-cookie"
    );
    const headers = new Headers();
    clearSessionCookieOnResponse(headers, "portal.denali.club:3003");
    const setCookies = headers.getSetCookie();
    assert.equal(setCookies.length, 2);
    assert.ok(setCookies.every((value) => value.includes(`${SESSION_TOKEN_COOKIE}=`)));
    assert.ok(setCookies.every((value) => /Max-Age=0/i.test(value)));
    assert.ok(setCookies.some((value) => /Domain=denali\.club/i.test(value)));
    assert.ok(setCookies.some((value) => !/Domain=/i.test(value)));
  });
});
