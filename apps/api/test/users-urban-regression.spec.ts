/**
 * Phase 9.4 — urban host must not expose Denali team directory (RULE-P9-002)
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { resetIdentityRepositoryForTests } from "../src/identity/create-identity-repository";
import { URBAN_SMOKE_E2E } from "./fixtures/urban-smoke-e2e-tenant";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type UsersApiResponse = {
  readonly items?: Array<Record<string, unknown>>;
  readonly code?: string;
};

function createUrbanUsersListener() {
  return createRequestListener({ toursService: createTestToursService() });
}

function urbanOwnerHeaders(): Record<string, string> {
  return {
    "x-tenant-id": URBAN_SMOKE_E2E.tenantId,
    "x-authenticated-tenant-id": URBAN_SMOKE_E2E.tenantId,
    "x-user-id": URBAN_SMOKE_E2E.ownerUserId,
    "x-actor-role": "owner",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": URBAN_SMOKE_E2E.workspaceId,
  };
}

describe("users-urban-regression.spec.ts — Phase 9.4 API", () => {
  const client = installHttpTestClient(createUrbanUsersListener);

  before(() => {
    const repo = resetIdentityRepositoryForTests();
    repo.seedUser({ id: URBAN_SMOKE_E2E.ownerUserId, mobile: "+15550004001" });
    repo.seedMembership({
      userId: URBAN_SMOKE_E2E.ownerUserId,
      tenantId: URBAN_SMOKE_E2E.tenantId,
      role: "owner",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: URBAN_SMOKE_E2E.workspaceId,
    });
  });

  it("API-9.4-URB-01 GET /users on urban host returns 403", async () => {
    const response = await client.requestJson<UsersApiResponse>("GET", "/users", {
      headers: urbanOwnerHeaders(),
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "USERS_WORKSPACE_FORBIDDEN");
  });

  it("API-9.4-URB-02 POST /users/invite on urban host returns 403", async () => {
    const response = await client.requestJson<UsersApiResponse>("POST", "/users/invite", {
      headers: urbanOwnerHeaders(),
      body: { phone: "+15550004999", role: "member" },
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "USERS_WORKSPACE_FORBIDDEN");
  });
});
