import assert from "node:assert/strict";
import test from "node:test";

import {
  extractAllSessionTokensFromCookieHeader,
  pickSessionTokenFromValues,
} from "./resolve-session-cookie";

function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

test("pickSessionTokenFromValues prefers valid JWT over expired duplicate", () => {
  const expired = fakeJwt({
    sub: "user-1",
    tenant_id: "tenant-1",
    exp: Math.floor(Date.now() / 1000) - 3600,
  });
  const valid = fakeJwt({
    sub: "user-1",
    tenant_id: "tenant-1",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const picked = pickSessionTokenFromValues([expired, valid]);
  assert.equal(picked?.validation.status, "valid");
  assert.equal(picked?.token, valid);
});

test("extractAllSessionTokensFromCookieHeader returns every session value", () => {
  const a = fakeJwt({ sub: "a", tenant_id: "t", exp: 9999999999 });
  const b = fakeJwt({ sub: "b", tenant_id: "t", exp: 9999999999 });
  const header = `session=${encodeURIComponent(a)}; other=1; session=${encodeURIComponent(b)}`;
  const tokens = extractAllSessionTokensFromCookieHeader(header);
  assert.equal(tokens.length, 2);
  assert.equal(tokens[0], a);
  assert.equal(tokens[1], b);
});
