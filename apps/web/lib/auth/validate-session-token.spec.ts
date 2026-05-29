import assert from "node:assert/strict";
import test from "node:test";

import { formatAuthAuditLabel, validateSessionToken } from "./validate-session-token";

function buildJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256" }))
    .toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

test("validateSessionToken rejects missing token", () => {
  assert.deepEqual(validateSessionToken(undefined), { status: "missing" });
  assert.equal(formatAuthAuditLabel({ status: "missing" }), "Token missing");
});

test("validateSessionToken accepts valid claims", () => {
  const token = buildJwt({
    sub: "user-1",
    tenant_id: "tenant-1",
    role: "owner",
  });
  const result = validateSessionToken(token);
  assert.equal(result.status, "valid");
  if (result.status === "valid") {
    assert.equal(result.userId, "user-1");
    assert.equal(result.tenantId, "tenant-1");
    assert.equal(formatAuthAuditLabel(result), "Token found");
  }
});

test("validateSessionToken rejects expired token", () => {
  const token = buildJwt({
    sub: "user-1",
    tenant_id: "tenant-1",
    exp: 1,
  });
  assert.equal(validateSessionToken(token).status, "expired");
});
