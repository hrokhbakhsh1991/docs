import assert from "node:assert/strict";
import test from "node:test";

import {
  buildClearHostOnlySessionCookieOptions,
  resolveSessionCookieDomain,
  SESSION_COOKIE_HOST_ONLY,
  shouldClearLegacyHostOnlySessionCookie,
} from "./build-session-cookie";

function setNodeEnv(value: string | undefined): void {
  Object.defineProperty(process.env, "NODE_ENV", {
    value,
    writable: true,
    configurable: true,
  });
}

test("resolveSessionCookieDomain is host-only in development by default", () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevDomain = process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN;
  setNodeEnv("development");
  delete process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN;

  try {
    assert.equal(resolveSessionCookieDomain(), undefined);
  } finally {
    setNodeEnv(prevNodeEnv);
    if (prevDomain === undefined) {
      delete process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN;
    } else {
      process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN = prevDomain;
    }
  }
});

test("resolveSessionCookieDomain uses NEXT_PUBLIC_SESSION_COOKIE_DOMAIN in production", () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevDomain = process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN;
  setNodeEnv("production");
  process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN = "company.com";

  try {
    assert.equal(resolveSessionCookieDomain(), ".company.com");
  } finally {
    setNodeEnv(prevNodeEnv);
    if (prevDomain === undefined) {
      delete process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN;
    } else {
      process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN = prevDomain;
    }
  }
});

test("buildClearHostOnlySessionCookieOptions omits domain", () => {
  const cookie = buildClearHostOnlySessionCookieOptions();
  assert.equal("domain" in cookie, false);
  assert.equal(cookie.maxAge, 0);
});

test("shouldClearLegacyHostOnlySessionCookie when domain-scoped cookies are used", () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevDomain = process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN;
  setNodeEnv("development");
  process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN = ".localhost";
  try {
    assert.equal(shouldClearLegacyHostOnlySessionCookie(), true);
  } finally {
    setNodeEnv(prevNodeEnv);
    if (prevDomain === undefined) {
      delete process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN;
    } else {
      process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN = prevDomain;
    }
  }
});

test("resolveSessionCookieDomain honors host-only override", () => {
  const prevDomain = process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN;
  process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN = SESSION_COOKIE_HOST_ONLY;

  try {
    assert.equal(resolveSessionCookieDomain(), undefined);
  } finally {
    if (prevDomain === undefined) {
      delete process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN;
    } else {
      process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN = prevDomain;
    }
  }
});
