export type PortalCommercialPricingLine = {
  readonly code: string;
  readonly amountMinor: string;
};

export type PortalCommercialPricingPreview = {
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
  readonly lines: readonly PortalCommercialPricingLine[];
};
