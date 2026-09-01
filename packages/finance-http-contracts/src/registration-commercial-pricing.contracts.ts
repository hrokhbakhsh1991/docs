/**
 * Cross-surface commercial pricing read model (portal, operator, finance invoice).
 * Server-authoritative — no client discount math.
 */

export const REGISTRATION_COMMERCIAL_QUOTE_SOURCES = [
  "tour_canonical",
  "operator_override",
  "free_collection",
  "member_discount",
] as const;

export type RegistrationCommercialQuoteSource =
  (typeof REGISTRATION_COMMERCIAL_QUOTE_SOURCES)[number];

export const REGISTRATION_COMMERCIAL_QUOTE_STATUSES = [
  "FROZEN",
  "SUPERSEDED",
  "LOCKED",
] as const;

export type RegistrationCommercialQuoteStatus =
  (typeof REGISTRATION_COMMERCIAL_QUOTE_STATUSES)[number];

export type RegistrationCommercialPricingDisplay = {
  readonly grossMinor: string;
  readonly memberDiscountPercentage: number | null;
  readonly memberDiscountMinor: string;
  readonly payableMinor: string;
  readonly currency: string;
  readonly quoteSource: RegistrationCommercialQuoteSource;
  readonly quoteStatus: RegistrationCommercialQuoteStatus | null;
  readonly membershipDiscountBlocked?: boolean;
  readonly memberPermanentDiscountPercentage?: number | null;
};

export function hasAppliedRegistrationMemberDiscount(
  display: RegistrationCommercialPricingDisplay
): boolean {
  return (
    display.quoteSource === "member_discount" &&
    Number.parseInt(display.memberDiscountMinor, 10) > 0
  );
}
