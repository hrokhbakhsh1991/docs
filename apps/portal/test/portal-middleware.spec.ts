import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { NextRequest } from "next/server";

import { middleware } from "../middleware";

const portalRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("portal middleware — P8-1-N-003", () => {
  it("P8-SES-04 middleware.ts exists with matcher", () => {
    const path = join(portalRoot, "middleware.ts");
    assert.ok(existsSync(path));
    const source = readFileSync(path, "utf8");
    assert.match(source, /export async function middleware/);
    assert.match(source, /export const config/);
    assert.match(source, /matcher:/);
    assert.match(source, /resolvePortalBootstrapForHost/);
    assert.match(source, /validateSessionTokenAsync/);
    assert.match(source, /resolvePortalIngressHost/);
    assert.match(source, /failClosedWhenUnresolved/);
    assert.match(source, /\/api\/me\//);
    assert.match(source, /redirectToMemberLogin/);
    assert.match(source, /resolvePortalMemberLoginPath/);
    assert.match(source, /\/login\?portalReturn=%2Fme%2Fregistrations/);
    assert.doesNotMatch(source, /function redirectHome/);
    assert.match(source, /\/me\//);
    assert.match(source, /shouldRefreshDevMemberSessionCookieDomain/);
    assert.match(source, /setSessionCookieOnResponse/);
    assert.match(source, /\/api\/public-auth\/expire-session/);
    assert.match(source, /skipSessionCookieRefresh/);
    assert.match(source, /toCanonicalClubPortalHost/);
    assert.match(source, /NextResponse\.redirect\(target, 308\)/);
  });
});

describe("portal middleware — PCMS-COOK-05 legacy host 308", () => {
  it("GET /login on legacy host redirects 308 with query preserved", async () => {
    const req = new NextRequest(
      "http://denali.portal.localhost:3003/login?portalReturn=%2Fme%2Fregistrations",
      {
        method: "GET",
        headers: { host: "denali.portal.localhost:3003" },
      }
    );
    const res = await middleware(req);
    assert.equal(res.status, 308);
    const location = res.headers.get("location");
    assert.ok(location);
    const loc = new URL(location);
    assert.equal(loc.hostname, "portal.denali.localhost");
    assert.equal(loc.port, "3003");
    assert.equal(loc.pathname, "/login");
    assert.equal(loc.searchParams.get("portalReturn"), "/me/registrations");
  });

  it("POST /api/public-auth/verify-otp on legacy host redirects 308", async () => {
    const req = new NextRequest("http://denali.portal.localhost:3003/api/public-auth/verify-otp", {
      method: "POST",
      headers: {
        host: "denali.portal.localhost:3003",
        "content-type": "application/json",
      },
      body: JSON.stringify({ phone: "+15550001111", otp: "1234", challenge_id: "c1" }),
    });
    const res = await middleware(req);
    assert.equal(res.status, 308);
    const location = res.headers.get("location");
    assert.ok(location);
    const loc = new URL(location);
    assert.equal(loc.hostname, "portal.denali.localhost");
    assert.equal(loc.port, "3003");
    assert.equal(loc.pathname, "/api/public-auth/verify-otp");
  });

  it("canonical portal host does not redirect", async () => {
    const req = new NextRequest("http://portal.denali.localhost:3003/login?portalReturn=%2Fme", {
      method: "GET",
      headers: { host: "portal.denali.localhost:3003" },
    });
    const res = await middleware(req);
    assert.notEqual(res.status, 308);
    assert.equal(res.headers.get("location"), null);
  });
});
