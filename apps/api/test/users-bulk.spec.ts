/**
 * Phase 9.4 — users directory bulk mutations (R8)
 * Authority: docs/phase-9/appendices/users-api-dispatch-addendum.md
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

type BulkUsersApiResponse = {
  readonly items?: Array<Record<string, unknown>>;
  readonly failures?: Array<{ userId: string; code: string }>;
  readonly code?: string;
};

function createUsersBulkTestListener() {
  return createRequestListener({ toursService: createTestToursService() });
}

describe("users-bulk.spec.ts — Phase 9.4 API R8", () => {
  const client = installHttpTestClient(createUsersBulkTestListener);

  before(() => {
    seedOperatorIdentityFixture();
    const repo = getIdentityRepository();
    repo.seedUser({ id: OPERATOR_SMOKE.memberUserId, mobile: "+15550001003" });
    repo.seedMembership({
      userId: OPERATOR_SMOKE.memberUserId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-member",
    });
    repo.seedUser({ id: OPERATOR_SMOKE.adminUserId, mobile: "+15550001002" });
    repo.seedMembership({
      userId: OPERATOR_SMOKE.adminUserId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "admin",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-admin",
    });
  });

  it("API-9.4-39 owner PATCH /users/bulk/suspend suspends multiple members (R8)", async () => {
    const memberA = "00000000-0000-4000-8000-000000000301";
    const memberB = "00000000-0000-4000-8000-000000000302";
    const repo = getIdentityRepository();
    for (const [id, mobile] of [
      [memberA, "+15550003001"],
      [memberB, "+15550003002"],
    ] as const) {
      repo.seedUser({ id, mobile });
      repo.seedMembership({
        userId: id,
        tenantId: OPERATOR_SMOKE.tenantId,
        role: "member",
        status: "ACTIVE",
        sessionVersion: 1,
        workspaceId: `ws-bulk-suspend-${id.slice(-3)}`,
      });
    }

    const response = await client.requestJson<BulkUsersApiResponse>("PATCH", "/users/bulk/suspend", {
      headers: operatorAuthHeaders(),
      body: { userIds: [memberA, memberB] },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.items?.length, 2);
    assert.equal(response.body.failures?.length ?? 0, 0);
    assert.equal(response.body.items?.every((row) => row.status === "SUSPENDED"), true);

    const membershipA = await repo.findMembership(memberA, OPERATOR_SMOKE.tenantId);
    assert.equal(membershipA?.status, "SUSPENDED");
  });

  it("API-9.4-40 owner PATCH /users/bulk/role updates multiple roles (R8)", async () => {
    const memberA = "00000000-0000-4000-8000-000000000311";
    const memberB = "00000000-0000-4000-8000-000000000312";
    const repo = getIdentityRepository();
    for (const [id, mobile] of [
      [memberA, "+15550003101"],
      [memberB, "+15550003102"],
    ] as const) {
      repo.seedUser({ id, mobile });
      repo.seedMembership({
        userId: id,
        tenantId: OPERATOR_SMOKE.tenantId,
        role: "member",
        status: "ACTIVE",
        sessionVersion: 1,
        workspaceId: `ws-bulk-role-${id.slice(-3)}`,
      });
    }

    const response = await client.requestJson<BulkUsersApiResponse>("PATCH", "/users/bulk/role", {
      headers: operatorAuthHeaders(),
      body: { userIds: [memberA, memberB], role: "viewer" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.items?.length, 2);
    assert.equal(response.body.items?.every((row) => row.role === "viewer"), true);
  });

  it("API-9.4-41 bulk suspend returns partial failures for self and owner targets (R8)", async () => {
    const memberId = "00000000-0000-4000-8000-000000000321";
    const adminId = "00000000-0000-4000-8000-000000000322";
    const repo = getIdentityRepository();
    repo.seedUser({ id: memberId, mobile: "+15550003201" });
    repo.seedMembership({
      userId: memberId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-bulk-partial-member",
    });
    repo.seedUser({ id: adminId, mobile: "+15550003202" });
    repo.seedMembership({
      userId: adminId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "admin",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-bulk-partial-admin",
    });

    const response = await client.requestJson<BulkUsersApiResponse>("PATCH", "/users/bulk/suspend", {
      headers: operatorAuthHeaders(),
      body: {
        userIds: [memberId, OPERATOR_SMOKE.ownerUserId, adminId],
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.items?.length, 2);
    assert.equal(response.body.failures?.length, 1);
    assert.equal(response.body.failures?.[0]?.userId, OPERATOR_SMOKE.ownerUserId);
    assert.equal(response.body.failures?.[0]?.code, "RBAC_SELF_ROLE_CHANGE_FORBIDDEN");
  });

  it("API-9.4-42 empty userIds returns 400 BULK_USER_IDS_REQUIRED (R8)", async () => {
    const response = await client.requestJson<BulkUsersApiResponse>("PATCH", "/users/bulk/suspend", {
      headers: operatorAuthHeaders(),
      body: { userIds: [] },
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "BULK_USER_IDS_REQUIRED");
  });

  it("API-9.4-43 admin cannot PATCH /users/bulk/suspend (DEC-P9-018)", async () => {
    const response = await client.requestJson<BulkUsersApiResponse>("PATCH", "/users/bulk/suspend", {
      headers: {
        ...operatorAuthHeaders(),
        "x-user-id": OPERATOR_SMOKE.adminUserId,
        "x-actor-role": "admin",
      },
      body: { userIds: [OPERATOR_SMOKE.memberUserId] },
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "USERS_DIRECTORY_FORBIDDEN");
  });
});
