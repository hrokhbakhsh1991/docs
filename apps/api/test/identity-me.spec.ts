/**
 * Phase 9.6 — identity-me API
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type ProfileResponse = {
  readonly userId?: string;
  readonly displayName?: string;
  readonly mobile?: string;
  readonly role?: string;
  readonly code?: string;
};

function createProfileTestListener() {
  return createRequestListener({ toursService: createTestToursService() });
}

describe("identity-me.spec.ts — Phase 9.6 S9-R7", () => {
  const client = installHttpTestClient(createProfileTestListener);

  before(() => {
    seedOperatorIdentityFixture();
  });

  it("API-9.6-ME-01 GET /identity/me requires session", async () => {
    const unauth = await client.requestJson<ProfileResponse>("GET", "/identity/me");
    assert.equal(unauth.status, 401);
  });

  it("API-9.6-ME-02 GET /identity/me returns mobile fallback displayName", async () => {
    const response = await client.requestJson<ProfileResponse>("GET", "/identity/me", {
      headers: operatorAuthHeaders(),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.userId, OPERATOR_SMOKE.ownerUserId);
    assert.equal(response.body.mobile, OPERATOR_SMOKE.ownerMobile);
    assert.equal(response.body.displayName, OPERATOR_SMOKE.ownerMobile);
    assert.equal(response.body.role, "owner");
  });

  it("API-9.6-ME-03 PATCH /identity/me updates displayName", async () => {
    const patched = await client.requestJson<ProfileResponse>("PATCH", "/identity/me", {
      headers: operatorAuthHeaders(),
      body: { displayName: "Smoke Owner" },
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.displayName, "Smoke Owner");

    const reread = await client.requestJson<ProfileResponse>("GET", "/identity/me", {
      headers: operatorAuthHeaders(),
    });
    assert.equal(reread.status, 200);
    assert.equal(reread.body.displayName, "Smoke Owner");
  });
});
