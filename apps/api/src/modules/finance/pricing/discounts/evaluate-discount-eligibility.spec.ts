import assert from "node:assert/strict";
import test from "node:test";
import { DiscountIneligibilityReason } from "./discount-eligibility";
import { evaluateDiscountEligibility } from "./evaluate-discount-eligibility";

const baseRule = {
  id: "rule-1",
  kind: "percent_off" as const,
  percentBps: 1000,
  tenantScope: { type: "single_tenant" as const, tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  stackability: { exclusiveWithRoleAdjustments: false }
};

test("evaluateDiscountEligibility eligible when all gates pass", () => {
  const r = evaluateDiscountEligibility({
    tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    asOfIso: "2026-06-01T12:00:00.000Z",
    coupon: { code: "SAVE", discountRuleId: "rule-1", active: true },
    rule: {
      ...baseRule,
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2027-01-01T00:00:00.000Z",
      maxRedemptionsTotal: 100,
      maxRedemptionsPerUser: 2
    },
    usage: { totalRedemptions: 0, userRedemptions: 0 },
    stacking: { appliedExclusiveGroupIds: [], hasRoleAdjustmentLines: false }
  });
  assert.equal(r.eligible, true);
  assert.equal(r.appliedDiscountRuleId, "rule-1");
});

test("evaluateDiscountEligibility rejects inactive coupon", () => {
  const r = evaluateDiscountEligibility({
    tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    asOfIso: "2026-06-01T12:00:00.000Z",
    coupon: { code: "SAVE", discountRuleId: "rule-1", active: false },
    rule: { ...baseRule },
    usage: { totalRedemptions: 0 },
    stacking: { appliedExclusiveGroupIds: [], hasRoleAdjustmentLines: false }
  });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.includes(DiscountIneligibilityReason.CODE_INACTIVE));
});

test("evaluateDiscountEligibility rejects tenant scope", () => {
  const r = evaluateDiscountEligibility({
    tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    asOfIso: "2026-06-01T12:00:00.000Z",
    coupon: { code: "SAVE", discountRuleId: "rule-1", active: true },
    rule: { ...baseRule },
    usage: { totalRedemptions: 0 },
    stacking: { appliedExclusiveGroupIds: [], hasRoleAdjustmentLines: false }
  });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.includes(DiscountIneligibilityReason.TENANT_SCOPE_MISMATCH));
});

test("evaluateDiscountEligibility rejects expiration", () => {
  const r = evaluateDiscountEligibility({
    tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    asOfIso: "2026-06-01T12:00:00.000Z",
    coupon: { code: "SAVE", discountRuleId: "rule-1", active: true },
    rule: {
      ...baseRule,
      validUntil: "2026-01-01T00:00:00.000Z"
    },
    usage: { totalRedemptions: 0 },
    stacking: { appliedExclusiveGroupIds: [], hasRoleAdjustmentLines: false }
  });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.includes(DiscountIneligibilityReason.EXPIRED));
});

test("evaluateDiscountEligibility rejects usage limits", () => {
  const r = evaluateDiscountEligibility({
    tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    asOfIso: "2026-06-01T12:00:00.000Z",
    coupon: { code: "SAVE", discountRuleId: "rule-1", active: true },
    rule: { ...baseRule, maxRedemptionsTotal: 1 },
    usage: { totalRedemptions: 1, userRedemptions: 0 },
    stacking: { appliedExclusiveGroupIds: [], hasRoleAdjustmentLines: false }
  });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.includes(DiscountIneligibilityReason.USAGE_LIMIT_TOTAL));
});

test("evaluateDiscountEligibility rejects stacking with role adjustments", () => {
  const r = evaluateDiscountEligibility({
    tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    asOfIso: "2026-06-01T12:00:00.000Z",
    coupon: { code: "SAVE", discountRuleId: "rule-1", active: true },
    rule: {
      ...baseRule,
      stackability: { exclusiveWithRoleAdjustments: true }
    },
    usage: { totalRedemptions: 0 },
    stacking: { appliedExclusiveGroupIds: [], hasRoleAdjustmentLines: true }
  });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.includes(DiscountIneligibilityReason.STACKING_CONFLICT));
});

test("evaluateDiscountEligibility rejects duplicate exclusive group", () => {
  const r = evaluateDiscountEligibility({
    tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    asOfIso: "2026-06-01T12:00:00.000Z",
    coupon: { code: "SAVE", discountRuleId: "rule-1", active: true },
    rule: {
      ...baseRule,
      stackability: {
        exclusiveGroupId: "summer",
        exclusiveWithRoleAdjustments: false
      }
    },
    usage: { totalRedemptions: 0 },
    stacking: { appliedExclusiveGroupIds: ["summer"], hasRoleAdjustmentLines: false }
  });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.includes(DiscountIneligibilityReason.STACKING_CONFLICT));
});
