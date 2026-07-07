import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SESSION_COOKIE_NAMES,
  createSessionCookieHelpers,
  decodeJwtPayload,
  setSessionCookieOnResponse,
  validateSessionToken,
} from "../src/index";

describe("session-client", () => {
  it("SESSION_COOKIE_NAMES differ operator vs member", () => {
    assert.notEqual(SESSION_COOKIE_NAMES.operator, SESSION_COOKIE_NAMES.member);
    assert.equal(SESSION_COOKIE_NAMES.operator, "atour_op_session");
    assert.equal(SESSION_COOKIE_NAMES.member, "atour_mb_session");
  });

  it("validateSessionToken rejects empty", () => {
    assert.deepEqual(validateSessionToken(""), { status: "missing" });
  });

  it("decodeJwtPayload parses payload segment", () => {
    const payload = Buffer.from(JSON.stringify({ sub: "u1", tenant_id: "t1" })).toString(
      "base64url"
    );
    const token = `hdr.${payload}.sig`;
    assert.deepEqual(decodeJwtPayload(token), { sub: "u1", tenant_id: "t1" });
  });

  it("createSessionCookieHelpers binds cookie name", () => {
    const member = createSessionCookieHelpers(SESSION_COOKIE_NAMES.member);
    assert.equal(member.cookieName, "atour_mb_session");
    assert.equal(member.buildSessionCookieOptions("tok").name, "atour_mb_session");
  });

  it("PCMS-COOK-04 setSessionCookieOnResponse includes Domain when provided", () => {
    const headers = new Headers();
    setSessionCookieOnResponse(headers, "atour_mb_session", "tok", { domain: "denali.club" });
    const setCookie = headers.get("set-cookie") ?? "";
    assert.match(setCookie, /Domain=denali\.club/);
  });
});
