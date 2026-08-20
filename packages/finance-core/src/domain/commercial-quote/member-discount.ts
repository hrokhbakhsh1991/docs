/**
 * Member discount commercial reducer — pure domain (CQ-2A).
 * Identity supplies percentage; Finance applies at quote freeze (wiring in CQ-2B+).
 */

import { assertCommercialQuoteMinor } from "./rules";

/** Audit metadata attached when source = member_discount (persistence in CQ-2C+). */
export type MemberDiscountQuoteMetadata = {
  readonly percentageApplied: number;
  readonly discountMinor: string;
  readonly memberUserId: string;
  readonly membershipReference: string;
};

export type MemberDiscountReducerResult = {
  readonly payableMinor: string;
  readonly discountMinor: string;
  readonly percentageApplied: number;
};

/**
 * Normalize membership discount percentage for reducer eligibility.
 * Returns null when no discount applies (null / undefined / 0).
 * Throws `MEMBER_DISCOUNT_INVALID_PERCENTAGE` for non-integer or out-of-range values.
 */
export function normalizeMemberDiscountPercentage(
  value: number | null | undefined
): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error("MEMBER_DISCOUNT_INVALID_PERCENTAGE");
  }
  if (value === 0) {
    return null;
  }
  return value;
}

/** Apply member discount to gross using integer minor units and floor division. */
export function applyMemberDiscountToGross(input: {
  readonly grossMinor: string;
  readonly percentage: number;
}): MemberDiscountReducerResult {
  const normalizedPct = normalizeMemberDiscountPercentage(input.percentage);
  if (normalizedPct === null) {
    throw new Error("MEMBER_DISCOUNT_INVALID_PERCENTAGE");
  }

  const gross = BigInt(assertCommercialQuoteMinor(input.grossMinor, "grossMinor"));
  const pct = BigInt(normalizedPct);
  const payable = (gross * (100n - pct)) / 100n;
  const discount = gross - payable;

  return {
    payableMinor: payable.toString(),
    discountMinor: discount.toString(),
    percentageApplied: normalizedPct,
  };
}

/**
 * Attempt member discount reducer; returns null when percentage is 0 / null / undefined.
 */
export function tryApplyMemberDiscountReducer(input: {
  readonly grossMinor: string;
  readonly percentage: number | null | undefined;
}): MemberDiscountReducerResult | null {
  const normalizedPct = normalizeMemberDiscountPercentage(input.percentage);
  if (normalizedPct === null) {
    return null;
  }
  return applyMemberDiscountToGross({
    grossMinor: input.grossMinor,
    percentage: normalizedPct,
  });
}

/** Build stable membership audit reference for quote metadata. */
export function buildMembershipReference(tenantId: string, memberUserId: string): string {
  const normalizedTenantId = tenantId.trim();
  const normalizedUserId = memberUserId.trim();
  if (normalizedTenantId.length === 0 || normalizedUserId.length === 0) {
    throw new Error("MEMBER_DISCOUNT_INVALID_MEMBERSHIP_REFERENCE");
  }
  return `userTenant:${normalizedTenantId}:${normalizedUserId}`;
}

export function buildMemberDiscountQuoteMetadata(input: {
  readonly tenantId: string;
  readonly memberUserId: string;
  readonly percentageApplied: number;
  readonly discountMinor: string;
}): MemberDiscountQuoteMetadata {
  return {
    percentageApplied: input.percentageApplied,
    discountMinor: assertCommercialQuoteMinor(input.discountMinor, "discountMinor"),
    memberUserId: input.memberUserId.trim(),
    membershipReference: buildMembershipReference(input.tenantId, input.memberUserId),
  };
}
