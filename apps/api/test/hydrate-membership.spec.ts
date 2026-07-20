import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AuthTokenRevokedError } from "../src/identity/identity.errors";
import {
  hydrateMembershipFromDb,
  normalizeMembershipRole,
} from "../src/identity/hydrate-membership";
import type { IdentityRepository } from "../src/identity/create-identity-repository";

describe("normalizeMembershipRole (DEC-P9-019)", () => {
  it("HYDRATE-R3-01 leader hydrates to admin", () => {
    assert.equal(normalizeMembershipRole("leader"), "admin");
  });

  it("HYDRATE-R3-02 viewer stays viewer", () => {
    assert.equal(normalizeMembershipRole("viewer"), "viewer");
  });

  it("HYDRATE-R3-03 unknown role becomes none", () => {
    assert.equal(normalizeMembershipRole("superadmin"), "none");
  });
});

describe("hydrateMembershipFromDb sess_ver (MR-P0-006)", () => {
  const membership = {
    userId: "u1",
    tenantId: "t1",
    role: "admin" as const,
    status: "ACTIVE" as const,
    sessionVersion: 2,
  };

  const repo = {
    findMembership: async () => membership,
  } as unknown as IdentityRepository;

  const deps = {
    resolveTenantStatus: async () => "ACTIVE" as const,
  };

  it("accepts matching sess_ver claim", async () => {
    const ctx = await hydrateMembershipFromDb("u1", "t1", 2, repo, deps);
    assert.equal(ctx.userId, "u1");
    assert.equal(ctx.role, "admin");
  });

  it("rejects mismatched sess_ver (revoked session)", async () => {
    await assert.rejects(
      () => hydrateMembershipFromDb("u1", "t1", 1, repo, deps),
      (error: unknown) => error instanceof AuthTokenRevokedError
    );
  });
});
