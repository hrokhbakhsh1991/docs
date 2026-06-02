import assert from "node:assert/strict";
import test from "node:test";

import { normalizeDiscountPercentage, parseMembershipMetadata } from "./membership-metadata";

test("parseMembershipMetadata reads allowedRegionIds and capabilities", () => {
  assert.deepEqual(
    parseMembershipMetadata({
      allowedRegionIds: ["  r1  ", "r2"],
      capabilities: ["tour.regional.manage"],
    }),
    {
      allowedRegionIds: ["r1", "r2"],
      capabilities: ["tour.regional.manage"],
    },
  );
});

test("parseMembershipMetadata reads permanent discount and reward badges", () => {
  assert.deepEqual(
    parseMembershipMetadata({
      permanentDiscountPercentage: 10.6,
      badges: ["vip_member", "LEADER_BUDDY", "INVALID", "VIP_MEMBER"],
    }),
    {
      permanentDiscountPercentage: 11,
      badges: ["VIP_MEMBER", "LEADER_BUDDY"],
    },
  );
});

test("normalizeDiscountPercentage clamps to 0–100", () => {
  assert.equal(normalizeDiscountPercentage(-5), 0);
  assert.equal(normalizeDiscountPercentage(150), 100);
  assert.equal(normalizeDiscountPercentage(undefined), undefined);
});
