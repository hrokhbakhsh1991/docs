/**
 * Portal member logout BFF — MEM-AUTH-01
 * @see docs/phase-19/platform-portal-member.mdoc
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SESSION_TOKEN_COOKIE } from "../src/auth/build-session-cookie";

describe("portal public-auth logout — MEM-AUTH-01", () => {
  it("MEM-AUTH-01 POST /api/public-auth/logout clears member session cookie", async () => {
    const { POST } = await import("../app/api/public-auth/logout/route");
    const req = new Request("http://denali.portal.localhost:3003/api/public-auth/logout", {
      method: "POST",
      headers: { host: "denali.portal.localhost:3003" },
    });
    const res = await POST(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok?: boolean };
    assert.equal(body.ok, true);
    const setCookies = res.headers.getSetCookie();
    assert.ok(setCookies.length >= 1);
    assert.ok(setCookies.every((value) => new RegExp(`${SESSION_TOKEN_COOKIE}=`).test(value)));
    assert.ok(setCookies.every((value) => /Max-Age=0/i.test(value)));
    assert.ok(setCookies.every((value) => /HttpOnly/i.test(value)));
  });
});
