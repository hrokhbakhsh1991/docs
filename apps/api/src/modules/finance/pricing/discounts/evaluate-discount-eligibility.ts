import type { CouponCode } from "./coupon-code";
import { DiscountIneligibilityReason, type DiscountEligibility } from "./discount-eligibility";
import type { DiscountRule } from "./discount-rule";

export type EvaluateDiscountEligibilityInput = {
  /** Checkout / quote tenant (must match rule scope). */
  readonly tenantId: string;
  /** Evaluation instant (ISO 8601). */
  readonly asOfIso: string;
  readonly coupon: CouponCode | null;
  /** Resolved catalog row for `coupon.discountRuleId`; null if missing. */
  readonly rule: DiscountRule | null;
  readonly usage: {
    readonly totalRedemptions: number;
    readonly userRedemptions?: number;
  };
  /**
   * Already-applied stacking context in the same quote pipeline (design hook).
   * `appliedExclusiveGroupIds` should contain group ids from rules already accepted earlier in discount stage.
   */
  readonly stacking: {
    readonly appliedExclusiveGroupIds: readonly string[];
    readonly hasRoleAdjustmentLines: boolean;
  };
};

function tenantMatchesScope(tenantId: string, rule: DiscountRule): boolean {
  const norm = tenantId.trim().toLowerCase();
  const scope = rule.tenantScope;
  if (scope.type === "single_tenant") {
    return scope.tenantId.trim().toLowerCase() === norm;
  }
  return scope.tenantIds.some((id) => id.trim().toLowerCase() === norm);
}

function parseInstant(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Number.NaN : t;
}

/**
 * Validates **expiration**, **usage limits**, **tenant scope**, and **stackability** constraints.
 * Returns **`eligible: true`** only when every gate passes — **does not** read catalog prices or change totals.
 *
 * **Integration (future):** call from a `PricingRule` in the `discount` **after** role lines are known,
 * before emitting promo line items; keep checkout unchanged until explicitly enabled.
 */
export function evaluateDiscountEligibility(
  input: EvaluateDiscountEligibilityInput
): DiscountEligibility {
  const reasons: DiscountIneligibilityReason[] = [];

  if (!input.coupon || !input.rule) {
    return {
      eligible: false,
      reasons: [DiscountIneligibilityReason.NO_CODE_OR_RULE]
    };
  }

  if (!input.coupon.active) {
    reasons.push(DiscountIneligibilityReason.CODE_INACTIVE);
  }

  if (input.coupon.discountRuleId.trim() !== input.rule.id.trim()) {
    reasons.push(DiscountIneligibilityReason.RULE_NOT_LOADED);
  }

  if (!tenantMatchesScope(input.tenantId, input.rule)) {
    reasons.push(DiscountIneligibilityReason.TENANT_SCOPE_MISMATCH);
  }

  const asOf = parseInstant(input.asOfIso);
  if (Number.isNaN(asOf)) {
    reasons.push(DiscountIneligibilityReason.INVALID_AS_OF);
  } else {
    if (input.rule.validFrom) {
      const from = parseInstant(input.rule.validFrom);
      if (!Number.isNaN(from) && asOf < from) {
        reasons.push(DiscountIneligibilityReason.NOT_YET_VALID);
      }
    }
    if (input.rule.validUntil) {
      const until = parseInstant(input.rule.validUntil);
      if (!Number.isNaN(until) && asOf >= until) {
        reasons.push(DiscountIneligibilityReason.EXPIRED);
      }
    }
  }

  const maxT = input.rule.maxRedemptionsTotal;
  if (maxT !== undefined && input.usage.totalRedemptions >= maxT) {
    reasons.push(DiscountIneligibilityReason.USAGE_LIMIT_TOTAL);
  }

  const maxU = input.rule.maxRedemptionsPerUser;
  if (maxU !== undefined && input.usage.userRedemptions !== undefined && input.usage.userRedemptions >= maxU) {
    reasons.push(DiscountIneligibilityReason.USAGE_LIMIT_USER);
  }

  const group = input.rule.stackability.exclusiveGroupId?.trim();
  if (group && input.stacking.appliedExclusiveGroupIds.some((g) => g === group)) {
    reasons.push(DiscountIneligibilityReason.STACKING_CONFLICT);
  }

  if (
    input.rule.stackability.exclusiveWithRoleAdjustments &&
    input.stacking.hasRoleAdjustmentLines
  ) {
    reasons.push(DiscountIneligibilityReason.STACKING_CONFLICT);
  }

  if (reasons.length > 0) {
    return { eligible: false, reasons };
  }

  return {
    eligible: true,
    reasons: [],
    appliedDiscountRuleId: input.rule.id
  };
}
