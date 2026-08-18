/**
 * PCMS-SEC-03 — dead-session vs outage classification for profile BFF.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyMemberProfileBffFailure,
  readMemberBffErrorCode,
} from "../src/me/classify-member-profile-bff-error";

describe("classifyMemberProfileBffFailure — PCMS-SEC-03", () => {
  it("treats 401/403/404 as unauthenticated", () => {
    assert.equal(classifyMemberProfileBffFailure(401), "unauthenticated");
    assert.equal(classifyMemberProfileBffFailure(403), "unauthenticated");
    assert.equal(classifyMemberProfileBffFailure(404), "unauthenticated");
  });

  it("treats identity revoke and invalid-bearer codes as unauthenticated", () => {
    assert.equal(
      classifyMemberProfileBffFailure(401, "AUTH_TOKEN_REVOKED"),
      "unauthenticated"
    );
    assert.equal(
      classifyMemberProfileBffFailure(401, "UNAUTHORIZED_INVALID_BEARER_TOKEN"),
      "unauthenticated"
    );
    assert.equal(
      classifyMemberProfileBffFailure(401, "AUTH_UNAUTHENTICATED"),
      "unauthenticated"
    );
    assert.equal(classifyMemberProfileBffFailure(401, "AUTH_INVALID_TOKEN"), "unauthenticated");
    assert.equal(
      classifyMemberProfileBffFailure(403, "AUTH_TENANT_HOST_MISMATCH"),
      "unauthenticated"
    );
  });

  it("keeps 502 / network-shaped codes as unavailable", () => {
    assert.equal(classifyMemberProfileBffFailure(502), "unavailable");
    assert.equal(classifyMemberProfileBffFailure(503), "unavailable");
    assert.equal(classifyMemberProfileBffFailure(500, "BACKEND_UNREACHABLE"), "unavailable");
    assert.equal(classifyMemberProfileBffFailure(0), "unavailable");
  });
});

describe("readMemberBffErrorCode — PCMS-SEC-03", () => {
  it("reads profile nested error.code, API code, and string error", () => {
    assert.equal(
      readMemberBffErrorCode({ error: { code: "AUTH_TOKEN_REVOKED" } }),
      "AUTH_TOKEN_REVOKED"
    );
    assert.equal(readMemberBffErrorCode({ code: "unauthorized" }), "unauthorized");
    assert.equal(
      readMemberBffErrorCode({ error: "UNAUTHORIZED_INVALID_BEARER_TOKEN" }),
      "UNAUTHORIZED_INVALID_BEARER_TOKEN"
    );
    assert.equal(readMemberBffErrorCode({}), undefined);
    assert.equal(readMemberBffErrorCode(null), undefined);
  });
});
