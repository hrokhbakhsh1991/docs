/**
 * Phase 9.4 R2 — rewards patch service
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { patchWorkspaceUserRewards } from "../src/identity/users.service";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { seedOperatorIdentityFixture } from "./fixtures/operator-identity-fixture";
import { installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

describe("users-rewards-patch.spec.ts — R2", () => {
  before(() => {
    seedOperatorIdentityFixture();
  });

  it("API-R2-01 patchWorkspaceUserRewards persists VIP badge and labels", async () => {
    const targetId = "00000000-0000-4000-8000-000000000186";
    const repo = getIdentityRepository();
    repo.seedUser({ id: targetId, mobile: "+15550001986" });
    repo.seedMembership({
      userId: targetId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-operator-rewards-r2-unit",
    });

    const row = await patchWorkspaceUserRewards(
      {
        userId: OPERATOR_SMOKE.ownerUserId,
        tenantId: OPERATOR_SMOKE.tenantId,
        role: "owner",
        status: "ACTIVE",
        workspaceId: "ws-operator-smoke",
      },
      targetId,
      {
        permanentDiscountPercentage: 20,
        badges: ["VIP_MEMBER"],
        labels: ["partner", "repeat"],
        isSelectableLeader: false,
      },
      repo
    );

    assert.equal(row.permanentDiscountPercentage, 20);
    assert.deepEqual(row.rewardBadges, ["VIP_MEMBER"]);
    assert.deepEqual(row.labels, ["partner", "repeat"]);
    assert.equal(row.isSelectableLeader, false);
  });
});
