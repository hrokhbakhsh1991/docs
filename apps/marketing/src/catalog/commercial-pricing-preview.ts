export type MarketingCommercialPricingLine = {
  readonly code: string;
  readonly amountMinor: string;
};

export type MarketingCommercialPricingPreview = {
  readonly grossMinor: string;
  readonly discountableBaseMinor: string;
  readonly memberDiscountPercentage: number;
  readonly memberDiscountMinor: string;
  readonly payableMinor: string;
  readonly currency: string;
  readonly source:
    | "member_discount"
    | "tour_canonical"
    | "free_collection"
    | "operator_override"
    | string;
  readonly lines: readonly MarketingCommercialPricingLine[];
};

export function hasMarketingMembershipDiscount(
  preview: MarketingCommercialPricingPreview | null | undefined
): preview is MarketingCommercialPricingPreview {
  if (preview == null || preview.source !== "member_discount") {
    return false;
  }
  return Number.parseInt(preview.memberDiscountMinor, 10) > 0;
}
