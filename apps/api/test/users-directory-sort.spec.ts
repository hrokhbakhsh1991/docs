/**
 * Phase 9.4 R4 — directory list sort (name + contact/email fallback)
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { listUsersDirectory } from "../src/identity/users.service";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { seedOperatorIdentityFixture } from "./fixtures/operator-identity-fixture";
import { installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

const ownerAuth = {
  userId: OPERATOR_SMOKE.ownerUserId,
  tenantId: OPERATOR_SMOKE.tenantId,
  role: "owner" as const,
  status: "ACTIVE" as const,
  workspaceId: "ws-operator-smoke",
};

describe("users-directory-sort.spec.ts — R4", () => {
  before(() => {
    seedOperatorIdentityFixture();
    const repo = getIdentityRepository();
    repo.seedUser({ id: "00000000-0000-4000-8000-000000000201", mobile: "+15550000201" });
    repo.seedUser({ id: "00000000-0000-4000-8000-000000000202", mobile: "+15559999202" });
    repo.seedMembership({
      userId: "00000000-0000-4000-8000-000000000201",
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      displayName: "Zulu Member",
      workspaceId: "ws-sort-r4",
    });
    repo.seedMembership({
      userId: "00000000-0000-4000-8000-000000000202",
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "admin",
      status: "ACTIVE",
      sessionVersion: 1,
      displayName: "Alpha Admin",
      workspaceId: "ws-sort-r4",
    });
  });

  it("API-9.4-37 email_asc sorts by phone when email absent (R4)", async () => {
    const repo = getIdentityRepository();
    const result = await listUsersDirectory(
      ownerAuth,
      { sort: "email_asc", limit: 50 },
      repo
    );
    const phones = result.items.map((row) => row.phone);
    const sorted = [...phones].sort((left, right) => (left ?? "").localeCompare(right ?? ""));
    assert.deepEqual(phones, sorted);
  });

  it("API-9.4-44 status=suspended filters before pagination", async () => {
    const suspendedId = "00000000-0000-4000-8000-000000000244";
    const repo = getIdentityRepository();
    repo.seedUser({ id: suspendedId, mobile: "+15550002441" });
    repo.seedMembership({
      userId: suspendedId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "SUSPENDED",
      sessionVersion: 1,
      displayName: "Suspended Only",
      workspaceId: "ws-status-filter",
    });

    const result = await listUsersDirectory(
      ownerAuth,
      { sort: "name_asc", limit: 50, status: "suspended" },
      repo
    );
    assert.equal(result.items.every((row) => row.status === "SUSPENDED"), true);
    assert.ok(result.items.some((row) => row.userId === suspendedId));
  });

  it("API-9.4-38 name_desc sorts displayName descending (R4)", async () => {
    const repo = getIdentityRepository();
    const result = await listUsersDirectory(
      ownerAuth,
      { sort: "name_desc", limit: 50 },
      repo
    );
    const names = result.items.map((row) => row.displayName);
    const sorted = [...names].sort((left, right) => right.localeCompare(left));
    assert.deepEqual(names, sorted);
  });
});
