import type { WorkspaceRole } from "@repo/shared";

export type PricingLineItemKind =
  | "base"
  | "workspace_role_adjustment"
  | "promo_code"
  | "tour_price_catalog";

export type PricingLineItem = {
  line_id: string;
  kind: PricingLineItemKind;
  description: string;
  amount_minor: string;
  currency_code: string;
  meta?: Record<string, unknown>;
};

export type PricingEngineInput = {
  tenantId: string;
  tourId: string;
  departureId: string;
  userRole: WorkspaceRole;
  discountCode?: string | null;
};

export type PricingQuoteResult = {
  line_items: PricingLineItem[];
  total: string;
  pricing_version: string;
  pricing_rule_version: string;
  currency_code: string;
};

export type PricingEngineQuoteOptions = {
  shadowLogOnly?: boolean;
  financeShadowCompare?: boolean;
};
