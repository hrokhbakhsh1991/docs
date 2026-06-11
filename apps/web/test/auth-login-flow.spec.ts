/**
 * Phase 9.1 — BFF login flow scaffold (legacy parity)
 * Authority: docs/phase-9/appendices/OPERATOR-LOGIN-FLOW.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
} from "../src/admin/require-operator-session";

describe("auth-login-flow.spec.ts — Phase 9.1 BFF", () => {
  it("BFF-9.1-01 contract exposes session cookie constants", () => {
    assert.equal(SESSION_COOKIE_NAME, "session");
    assert.equal(SESSION_COOKIE_MAX_AGE_SECONDS, 604_800);
  });

  it("BFF-9.1-02 buildSessionCookieOptions uses HttpOnly session name", async () => {
    const { buildSessionCookieOptions } = await import("../src/auth/build-session-cookie");
    const cookie = buildSessionCookieOptions("test-token");
    assert.equal(cookie.name, SESSION_COOKIE_NAME);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.maxAge, SESSION_COOKIE_MAX_AGE_SECONDS);
  });

  it("BFF-9.1-03 validateSessionToken accepts signed operator JWT shape", async () => {
    const { validateSessionToken } = await import("../src/auth/validate-session-token");
    const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "00000000-0000-4000-8000-000000000101",
        tenant_id: "00000000-0000-4000-8000-000000000014",
        role: "owner",
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString("base64url");
    const token = `${header}.${payload}.sig`;
    const result = validateSessionToken(token);
    assert.equal(result.status, "valid");
    if (result.status === "valid") {
      assert.equal(result.role, "owner");
    }
  });

  it("BFF-9.1-04 middleware fail-closed redirects anonymous (app) routes", async () => {
    const { NextRequest } = await import("next/server");
    const { middleware } = await import("../middleware");
    const req = new NextRequest("http://127.0.0.1:3000/bookings");
    const res = middleware(req);
    assert.ok(res.status >= 300 && res.status < 400);
    const location = res.headers.get("location") ?? "";
    assert.match(location, /\/auth\/login\?returnUrl=/);
  });

  it("BFF-9.1-07 middleware allows anonymous login BFF phone-preflight", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const middlewareSource = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../middleware.ts"),
      "utf8"
    );
    assert.match(middlewareSource, /\/api\/auth\/phone-preflight/);
  });

  it("BFF-9.1-08 middleware allows anonymous public-auth BFF routes", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const middlewareSource = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../middleware.ts"),
      "utf8"
    );
    assert.match(middlewareSource, /\/api\/public-auth\/phone-preflight/);
    assert.match(middlewareSource, /\/api\/public-auth\/verify-otp/);
    assert.match(middlewareSource, /\/api\/public-auth\/register-complete/);
    assert.match(middlewareSource, /\/api\/public-auth\/session-profile/);
  });

  it("BFF-9.1-06 middleware blocks anonymous BFF /api/users with 401", async () => {
    const { NextRequest } = await import("next/server");
    const { middleware } = await import("../middleware");
    const req = new NextRequest("http://denali.localhost:3000/api/users");
    const res = middleware(req);
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "AUTH_UNAUTHENTICATED");
  });

  it("BFF-9.1-05 logout BFF clears HttpOnly session cookie", async () => {
    const { POST } = await import("../app/api/auth/logout/route");
    const res = await POST();
    assert.equal(res.status, 200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    assert.match(setCookie, /session=/);
    assert.match(setCookie, /Max-Age=0/i);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /operator-welcome-armed=/);
    assert.match(setCookie, /Max-Age=0/i);
  });
});
