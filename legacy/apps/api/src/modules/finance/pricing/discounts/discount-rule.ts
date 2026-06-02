/**
 * Declarative discount / coupon rule (design-time). **Not wired** into `PricingEngine` totals yet.
 *
 * TODO: **Referral discounts** — inviter / invitee split + fraud caps.
 * TODO: **Campaign engine** — attach rules to campaigns with budgets + pacing.
 * TODO: **Seasonal campaigns** — calendar windows + catalog segment predicates.
 */
export type DiscountRuleKind = "percent_off" | "fixed_minor_off";

/** Where the rule may be evaluated (tenant isolation for multi-tenant SaaS). */
export type DiscountTenantScope =
  | { readonly type: "single_tenant"; readonly tenantId: string }
  | { readonly type: "tenant_allowlist"; readonly tenantIds: readonly string[] };

/**
 * Stacking policy for the discount **stage** (does not mutate lines until integration lands).
 * - **exclusiveGroupId:** at most one live promo per group per quote (e.g. `summer_2026`).
 * - **exclusiveWithRoleAdjustments:** when true, forbid combining with workspace staff / role lines.
 */
export type DiscountStackability = {
  readonly exclusiveGroupId?: string;
  readonly exclusiveWithRoleAdjustments: boolean;
};

export type DiscountRule = {
  readonly id: string;
  readonly kind: DiscountRuleKind;
  /** Basis points for `percent_off` (100 = 1%). */
  readonly percentBps?: number;
  /** Minor units string for `fixed_minor_off`. */
  readonly fixedMinorOff?: string;
  readonly currency?: string;
  /** Inclusive lower bound (`validFrom <= asOf`). */
  readonly validFrom?: string;
  /** Exclusive upper bound (`asOf < validUntil`) — policy may harden later. */
  readonly validUntil?: string;
  readonly maxRedemptionsTotal?: number;
  readonly maxRedemptionsPerUser?: number;
  readonly tenantScope: DiscountTenantScope;
  readonly stackability: DiscountStackability;
};
