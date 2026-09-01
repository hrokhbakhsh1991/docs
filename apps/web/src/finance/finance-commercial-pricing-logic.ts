import type { RegistrationCommercialPricingDisplay } from "@app-tour/finance-http-contracts";

export type { RegistrationCommercialPricingDisplay };

export function parseRegistrationCommercialPricing(
  raw: unknown
): RegistrationCommercialPricingDisplay | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  const grossMinor = String(row.grossMinor ?? "");
  const payableMinor = String(row.payableMinor ?? "");
  const memberDiscountMinor = String(row.memberDiscountMinor ?? "0");
  const currency = String(row.currency ?? "");
  const quoteSource = String(row.quoteSource ?? "");
  if (
    !/^\d+$/.test(grossMinor) ||
    !/^\d+$/.test(payableMinor) ||
    !/^\d+$/.test(memberDiscountMinor) ||
    currency.length === 0 ||
    quoteSource.length === 0
  ) {
    return null;
  }
  const memberDiscountPercentage =
    row.memberDiscountPercentage === null || row.memberDiscountPercentage === undefined
      ? null
      : Number(row.memberDiscountPercentage);
  if (
    memberDiscountPercentage !== null &&
    (!Number.isInteger(memberDiscountPercentage) ||
      memberDiscountPercentage < 0 ||
      memberDiscountPercentage > 100)
  ) {
    return null;
  }
  const quoteStatus =
    row.quoteStatus === null || row.quoteStatus === undefined
      ? null
      : String(row.quoteStatus);
  const memberPermanentDiscountPercentage =
    row.memberPermanentDiscountPercentage === null ||
    row.memberPermanentDiscountPercentage === undefined
      ? undefined
      : Number(row.memberPermanentDiscountPercentage);
  return {
    grossMinor,
    payableMinor,
    memberDiscountMinor,
    currency,
    quoteSource: quoteSource as RegistrationCommercialPricingDisplay["quoteSource"],
    quoteStatus: quoteStatus as RegistrationCommercialPricingDisplay["quoteStatus"],
    memberDiscountPercentage,
    ...(row.membershipDiscountBlocked === true ? { membershipDiscountBlocked: true } : {}),
    ...(memberPermanentDiscountPercentage !== undefined
      ? { memberPermanentDiscountPercentage }
      : {}),
  };
}

export function hasVisibleMemberDiscount(
  pricing: RegistrationCommercialPricingDisplay | null | undefined
): pricing is RegistrationCommercialPricingDisplay {
  return (
    pricing != null &&
    pricing.quoteSource === "member_discount" &&
    Number.parseInt(pricing.memberDiscountMinor, 10) > 0
  );
}
