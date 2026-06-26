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
  readonly avatarUrl?: string | null;
  readonly gender?: string | null;
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

  it("API-9.6-ME-04 GET /identity/me returns avatarUrl null by default", async () => {
    const response = await client.requestJson<ProfileResponse>("GET", "/identity/me", {
      headers: operatorAuthHeaders(),
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.avatarUrl, null);
    assert.equal(response.body.gender, null);
  });

  it("API-9.6-ME-04b PATCH /identity/me updates optional gender", async () => {
    const patched = await client.requestJson<ProfileResponse>("PATCH", "/identity/me", {
      headers: operatorAuthHeaders(),
      body: { displayName: "Smoke Owner", gender: "female" },
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.body.gender, "female");

    const cleared = await client.requestJson<ProfileResponse>("PATCH", "/identity/me", {
      headers: operatorAuthHeaders(),
      body: { gender: null },
    });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.gender, null);
  });

  it("API-9.6-ME-04c PATCH /identity/me rejects invalid gender", async () => {
    const response = await client.requestJson<ProfileResponse>("PATCH", "/identity/me", {
      headers: operatorAuthHeaders(),
      body: { gender: "invalid" },
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "PROFILE_GENDER_INVALID");
  });

  it("API-9.6-ME-05 POST /identity/me/avatar without Content-Type returns 400", async () => {
    const response = await client.requestJson<ProfileResponse>("POST", "/identity/me/avatar", {
      headers: operatorAuthHeaders(),
    });
    assert.equal(response.status, 400);
  });

  it("API-9.6-ME-06 GET /identity/me/avatar/url without avatar returns 404", async () => {
    const response = await client.requestJson<ProfileResponse>("GET", "/identity/me/avatar/url", {
      headers: operatorAuthHeaders(),
    });
    assert.equal(response.status, 404);
    assert.equal(response.body.code, "OPERATOR_AVATAR_NOT_SET");
  });

  it("API-9.6-ME-07 POST /identity/me/avatar invalid content-type returns 400", async () => {
    const response = await client.requestJson<ProfileResponse>("POST", "/identity/me/avatar", {
      headers: {
        ...operatorAuthHeaders(),
        "Content-Type": "image/svg+xml",
      },
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "OPERATOR_AVATAR_CONTENT_TYPE_INVALID");
  });
});
