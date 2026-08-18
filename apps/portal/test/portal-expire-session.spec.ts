/**
 * PCMS-SEC-03 — GET /api/public-auth/expire-session clears cookie then /login.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SESSION_TOKEN_COOKIE } from "../src/auth/build-session-cookie";

describe("portal public-auth expire-session — PCMS-SEC-03", () => {
  it("GET 307 to member login and clears atour_mb_session", async () => {
    const { GET } = await import("../app/api/public-auth/expire-session/route");
    const req = new Request(
      "http://denali.portal.localhost:3003/api/public-auth/expire-session?portalReturn=%2Fme%2Fprofile",
      {
        method: "GET",
        headers: { host: "denali.portal.localhost:3003" },
      }
    );
    const res = await GET(req);
    assert.equal(res.status, 307);
    const location = res.headers.get("location") ?? "";
    assert.match(location, /\/login/);
    assert.match(location, /portalReturn=%2Fme%2Fprofile/);
    assert.doesNotMatch(location, /denali\.localhost:3002/);
    assert.doesNotMatch(location, /:3002\//);

    const setCookies = res.headers.getSetCookie();
    assert.ok(setCookies.length >= 1);
    assert.ok(setCookies.every((value) => new RegExp(`${SESSION_TOKEN_COOKIE}=`).test(value)));
    assert.ok(setCookies.every((value) => /Max-Age=0/i.test(value)));
    assert.ok(setCookies.every((value) => /HttpOnly/i.test(value)));
  });

  it("rejects open-redirect portalReturn and falls back to /me/registrations", async () => {
    const { GET } = await import("../app/api/public-auth/expire-session/route");
    const req = new Request(
      "http://denali.portal.localhost:3003/api/public-auth/expire-session?portalReturn=https%3A%2F%2Fevil.example",
      {
        method: "GET",
        headers: { host: "denali.portal.localhost:3003" },
      }
    );
    const res = await GET(req);
    assert.equal(res.status, 307);
    const location = res.headers.get("location") ?? "";
    assert.match(location, /\/login/);
    assert.match(location, /portalReturn=%2Fme%2Fregistrations/);
    assert.doesNotMatch(location, /evil\.example/);
  });

  it("rejects protocol-relative portalReturn", async () => {
    const { GET } = await import("../app/api/public-auth/expire-session/route");
    const req = new Request(
      "http://portal.denali.localhost:3003/api/public-auth/expire-session?portalReturn=%2F%2Fevil.example",
      {
        method: "GET",
        headers: { host: "portal.denali.localhost:3003" },
      }
    );
    const res = await GET(req);
    assert.equal(res.status, 307);
    const location = res.headers.get("location") ?? "";
    assert.match(location, /\/login/);
    assert.doesNotMatch(location, /evil\.example/);
  });
});
