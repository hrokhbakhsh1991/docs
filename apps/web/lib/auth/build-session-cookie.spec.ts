import assert from "node:assert/strict";
import test from "node:test";

import { resolveSessionCookieDomain, SESSION_COOKIE_HOST_ONLY } from "./build-session-cookie";

test("resolveSessionCookieDomain uses .localhost in development by default", () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevDomain = process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN;
  process.env.NODE_ENV = "development";
  delete process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN;

  try {
    assert.equal(resolveSessionCookieDomain(), ".localhost");
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
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
  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN = "company.com";

  try {
    assert.equal(resolveSessionCookieDomain(), ".company.com");
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
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
