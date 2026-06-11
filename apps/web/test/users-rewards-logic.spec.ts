/**
 * Phase 9.4 R2 — users rewards logic
 * Authority: docs/phase-9/appendices/USERS-DIRECTORY-UX.md §6.7
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addRewardLabel,
  buildRewardsPatchPayload,
  collectUserRowMicroBadges,
  removeRewardLabel,
  resolveLoyaltyTierFromBadges,
} from "../src/features/users/users-rewards-logic";

describe("users-rewards-logic.spec.ts — R2", () => {
  it("WEB-R2-01 resolveLoyaltyTierFromBadges prefers GOLD over VIP", () => {
    assert.equal(resolveLoyaltyTierFromBadges(["VIP_MEMBER", "GOLD_CLUB"]), "GOLD_CLUB");
    assert.equal(resolveLoyaltyTierFromBadges(["VIP_MEMBER"]), "VIP_MEMBER");
    assert.equal(resolveLoyaltyTierFromBadges([]), "none");
  });

  it("WEB-R2-02 label editor normalizes and dedupes", () => {
    assert.deepEqual(addRewardLabel([], "  VIP  "), ["VIP"]);
    assert.deepEqual(addRewardLabel(["VIP"], "VIP"), ["VIP"]);
    assert.deepEqual(removeRewardLabel(["a", "b"], 1), ["a"]);
  });

  it("WEB-R2-03 buildRewardsPatchPayload maps tier labels and discount", () => {
    const built = buildRewardsPatchPayload({
      previous: {
        userId: "u1",
        tenantId: "t1",
        role: "member",
        status: "ACTIVE",
        displayName: "Ali",
        phone: null,
      },
      discountRaw: "10",
      loyaltyTier: "VIP_MEMBER",
      labels: ["loyal"],
      selectableLeader: true,
      leaderBuddy: false,
    });
    assert.equal(built.ok, true);
    if (built.ok) {
      assert.deepEqual(built.payload.badges, ["VIP_MEMBER"]);
      assert.deepEqual(built.payload.labels, ["loyal"]);
      assert.equal(built.payload.permanentDiscountPercentage, 10);
      assert.equal(built.payload.isSelectableLeader, true);
    }
  });

  it("WEB-R2-04 collectUserRowMicroBadges renders legacy chip set", () => {
    const badges = collectUserRowMicroBadges({
      userId: "u1",
      tenantId: "t1",
      role: "member",
      status: "ACTIVE",
      displayName: "Ali",
      phone: null,
      permanentDiscountPercentage: 15,
      rewardBadges: ["GOLD_CLUB"],
      labels: ["partner"],
      isSelectableLeader: true,
    });
    assert.equal(badges.length, 4);
    assert.equal(badges[0]?.kind, "discount");
    assert.equal(badges[1]?.kind, "loyalty");
    assert.equal(badges[2]?.kind, "label");
    assert.equal(badges[3]?.kind, "selectableLeader");
  });

  it("WEB-R2-05 buildRewardsPatchPayload preserves LEADER_BUDDY badge (R2)", () => {
    const built = buildRewardsPatchPayload({
      previous: {
        userId: "u1",
        tenantId: "t1",
        role: "member",
        status: "ACTIVE",
        displayName: "Ali",
        phone: null,
        rewardBadges: ["VIP_MEMBER", "LEADER_BUDDY"],
      },
      discountRaw: "",
      loyaltyTier: "GOLD_CLUB",
      labels: [],
      selectableLeader: false,
      leaderBuddy: true,
    });
    assert.equal(built.ok, true);
    if (built.ok) {
      assert.deepEqual(built.payload.badges, ["GOLD_CLUB", "LEADER_BUDDY"]);
    }
  });

  it("WEB-R2-06 buildRewardsPatchPayload clears LEADER_BUDDY when toggled off (R2)", () => {
    const built = buildRewardsPatchPayload({
      previous: {
        userId: "u1",
        tenantId: "t1",
        role: "member",
        status: "ACTIVE",
        displayName: "Ali",
        phone: null,
        rewardBadges: ["LEADER_BUDDY"],
      },
      discountRaw: "",
      loyaltyTier: "none",
      labels: [],
      selectableLeader: false,
      leaderBuddy: false,
    });
    assert.equal(built.ok, true);
    if (built.ok) {
      assert.deepEqual(built.payload.badges, []);
    }
  });
});
