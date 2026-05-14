import type { WorkspaceRole } from "@repo/shared-rbac";

export type PricingLineItemKind =
  | "base"
  | "workspace_role_adjustment"
  | "promo_code"
  | "tour_price_catalog";

export type PricingLineItem = {
  line_id: string;
  kind: PricingLineItemKind;
  description: string;
  /** Signed minor units (string for bigint columns / JSON safety). Discounts are negative. */
  amount_minor: string;
  currency_code: string;
  meta?: Record<string, unknown>;
};

/**
 * Server-only pricing inputs. Callers must never accept a client-supplied total or line totals.
 */
export type PricingEngineInput = {
  tenantId: string;
  tourId: string;
  departureId: string;
  userRole: WorkspaceRole;
  discountCode?: string | null;
};

export type PricingQuoteResult = {
  line_items: PricingLineItem[];
  /** Sum of {@link PricingLineItem.amount_minor} (minor units, decimal string). */
  total: string;
  /** @deprecated Prefer {@link pricing_rule_version}; kept for existing persistence (`quoted_pricing_version`). */
  pricing_version: string;
  /** Deterministic fingerprint of rule bundle + inputs + lines (mirrors `pricing_version` for persistence). */
  pricing_rule_version: string;
  currency_code: string;
};

export type PricingEngineQuoteOptions = {
  /**
   * When true, emits a structured log line with inputs + quote (debug / audit only).
   * Does not change totals — same authoritative finance quote as normal mode.
   */
  shadowLogOnly?: boolean;
  /**
   * When true, runs the legacy catalog quote in parallel and logs `PRICING_SHADOW_DIFF`
   * against the authoritative finance quote. **Off by default**; drift monitoring only.
   */
  financeShadowCompare?: boolean;
};
