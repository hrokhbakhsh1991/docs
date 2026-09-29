import type { MarketingCatalogCard } from "./catalog-types";
import type { MarketingCommercialPricingPreview } from "./commercial-pricing-preview";
import type { MarketingCommercialPricingPreviewStatus } from "./fetch-commercial-pricing-previews.server";

export type MarketingCatalogPricingPreviews = Readonly<
  Record<string, MarketingCommercialPricingPreview>
>;

/**
 * Return the amount the current viewer sees for list filtering/sorting.
 *
 * The catalog API's canonical price is still the fallback for anonymous users
 * and for previews without a membership discount. A member preview must win,
 * otherwise PLP order/filtering can disagree with the price rendered by the
 * card and PDP.
 */
export function resolveMarketingCatalogListPrice(
  item: MarketingCatalogCard,
  pricingPreviews?: MarketingCatalogPricingPreviews,
  pricingPreviewStatus: MarketingCommercialPricingPreviewStatus = "anonymous"
): number | null {
  if (item.paymentCollection === "free") {
    return 0;
  }

  const preview = pricingPreviews?.[item.id];
  // The card fails closed when an authenticated member preview is missing.
  // Filtering/sorting must use the same contract; falling back to the public
  // base price here would make order/filter results disagree with the card.
  if (preview === undefined && pricingPreviewStatus !== "anonymous") {
    return null;
  }
  if (preview?.source === "member_discount") {
    const discount = Number.parseInt(preview.memberDiscountMinor, 10);
    const payable = Number.parseInt(preview.payableMinor, 10);
    if (Number.isFinite(discount) && discount > 0 && Number.isFinite(payable)) {
      return payable;
    }
  }

  return item.priceAmount != null && Number.isFinite(item.priceAmount)
    ? item.priceAmount
    : null;
}
