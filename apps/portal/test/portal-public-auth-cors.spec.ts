import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { NextRequest } from "next/server";

import { middleware } from "../middleware";
import {
  applyPublicAuthCorsHeaders,
  isPortalPublicAuthApiPath,
} from "../src/auth/apply-public-auth-cors";

const portalRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(portalRoot, "../..");

describe("portal public-auth CORS — Phase 4", () => {
  it("PCMS-CORS-P4-05 path helper is public-auth only", () => {
    assert.equal(isPortalPublicAuthApiPath("/api/public-auth/verify-otp"), true);
    assert.equal(isPortalPublicAuthApiPath("/api/public-auth/session"), true);
    assert.equal(isPortalPublicAuthApiPath("/api/me/profile"), false);
    assert.equal(isPortalPublicAuthApiPath("/login"), false);
  });

  it("PCMS-CORS-P4-06 apply helper refuses wildcard origin", () => {
    const headers = new Headers();
    applyPublicAuthCorsHeaders(headers, "*");
    assert.equal(headers.get("Access-Control-Allow-Origin"), null);
    applyPublicAuthCorsHeaders(headers, "http://denali.club:3002");
    assert.equal(headers.get("Access-Control-Allow-Origin"), "http://denali.club:3002");
    assert.equal(headers.get("Access-Control-Allow-Credentials"), "true");
    assert.equal(headers.get("Vary"), "Origin");
  });

  it("PCMS-CORS-P4-07 OPTIONS preflight allows paired marketing origin", async () => {
    const req = new NextRequest("http://portal.denali.club:3003/api/public-auth/request-otp", {
      method: "OPTIONS",
      headers: {
        host: "portal.denali.club:3003",
        origin: "http://denali.club:3002",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    const res = await middleware(req);
    assert.equal(res.status, 204);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), "http://denali.club:3002");
    assert.equal(res.headers.get("Access-Control-Allow-Credentials"), "true");
    assert.match(res.headers.get("Access-Control-Allow-Methods") ?? "", /POST/);
    assert.equal(res.headers.has("set-cookie"), false);
  });

  it("PCMS-CORS-P4-08 OPTIONS from a foreign origin is 403 without ACAO", async () => {
    const req = new NextRequest("http://portal.denali.club:3003/api/public-auth/request-otp", {
      method: "OPTIONS",
      headers: {
        host: "portal.denali.club:3003",
        origin: "https://evil.example",
      },
    });
    const res = await middleware(req);
    assert.equal(res.status, 403);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
  });

  it("PCMS-CORS-P4-09 /api/me/profile does not receive CORS", async () => {
    const req = new NextRequest("http://portal.denali.club:3003/api/me/profile", {
      method: "OPTIONS",
      headers: {
        host: "portal.denali.club:3003",
        origin: "http://denali.club:3002",
      },
    });
    const res = await middleware(req);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
    assert.notEqual(res.status, 204);
  });

  it("PCMS-CORS-P4-13 GET public-auth session echoes paired marketing origin", async () => {
    const req = new NextRequest("http://portal.denali.club:3003/api/public-auth/session", {
      method: "GET",
      headers: {
        host: "portal.denali.club:3003",
        origin: "http://denali.club:3002",
      },
    });
    const res = await middleware(req);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), "http://denali.club:3002");
    assert.equal(res.headers.get("Access-Control-Allow-Credentials"), "true");
  });

  it("PCMS-CORS-P4-10 cookie Domain helpers and API public-auth stay unchanged", () => {
    const cookie = readFileSync(join(portalRoot, "src/auth/build-session-cookie.ts"), "utf8");
    assert.match(cookie, /resolveMemberSessionCookieDomain/);
    assert.doesNotMatch(cookie, /Access-Control-Allow-Origin/);

    const apiPublicAuth = readFileSync(
      join(repoRoot, "apps/api/src/identity/public-auth.routes.ts"),
      "utf8"
    );
    assert.doesNotMatch(apiPublicAuth, /Access-Control-Allow-Origin/);
    assert.doesNotMatch(apiPublicAuth, /Access-Control-Allow-Credentials/);

    const middlewareSrc = readFileSync(join(portalRoot, "middleware.ts"), "utf8");
    assert.match(middlewareSrc, /resolvePublicAuthCorsAllowOrigin/);
    assert.match(middlewareSrc, /isPortalPublicAuthApiPath/);
    assert.match(middlewareSrc, /applyPublicAuthCorsHeaders/);
  });
});
