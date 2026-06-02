/**
 * Customer-entered or deep-linked coupon surface. Persistence / normalization TBD.
 */
export type CouponCode = {
  /** Normalized presentation (e.g. uppercased, trimmed). */
  readonly code: string;
  readonly discountRuleId: string;
  readonly active: boolean;
};
