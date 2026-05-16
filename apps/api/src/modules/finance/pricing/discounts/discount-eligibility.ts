/**
 * Outcome of **eligibility-only** validation — does **not** compute monetary deltas (pricing engine owns totals).
 */
export type DiscountEligibility = {
  readonly eligible: boolean;
  readonly reasons: readonly DiscountIneligibilityReason[];
  /** Populated when `eligible` — caller may attach to quote metadata / audit only. */
  readonly appliedDiscountRuleId?: string;
};

export enum DiscountIneligibilityReason {
  NO_CODE_OR_RULE = "no_code_or_rule",
  CODE_INACTIVE = "code_inactive",
  RULE_NOT_LOADED = "rule_not_loaded",
  TENANT_SCOPE_MISMATCH = "tenant_scope_mismatch",
  EXPIRED = "expired",
  NOT_YET_VALID = "not_yet_valid",
  INVALID_AS_OF = "invalid_as_of",
  USAGE_LIMIT_TOTAL = "usage_limit_total",
  USAGE_LIMIT_USER = "usage_limit_user",
  STACKING_CONFLICT = "stacking_conflict"
}
