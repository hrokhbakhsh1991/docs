/**
 * Registration commercial pricing read model — server-authoritative display (CQ-DISPLAY).
 */

import type {
  RegistrationCommercialPricingDisplay,
  RegistrationCommercialQuoteSource,
  RegistrationCommercialQuoteStatus,
} from "@app-tour/finance-http-contracts";

import type { CommercialQuoteFreezeInput } from "./freeze-input";
import type { CommercialQuoteSource, CommercialQuoteStatus, CommercialQuoteVersion } from "./types";

export type { RegistrationCommercialPricingDisplay };

function normalizeMinorDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function toContractSource(source: CommercialQuoteSource): RegistrationCommercialQuoteSource {
  return source;
}

function toContractStatus(
  status: CommercialQuoteStatus | null | undefined
): RegistrationCommercialQuoteStatus | null {
  return status ?? null;
}

export function mapFreezeInputToCommercialPricingDisplay(
  input: CommercialQuoteFreezeInput,
  options: {
    readonly quoteStatus?: CommercialQuoteStatus | null;
    readonly membershipDiscountBlocked?: boolean;
    readonly memberPermanentDiscountPercentage?: number | null;
  } = {}
): RegistrationCommercialPricingDisplay {
  const memberDiscount = input.memberDiscount;
  return {
    grossMinor: normalizeMinorDigits(input.grossMinor),
    memberDiscountPercentage: memberDiscount?.percentageApplied ?? null,
    memberDiscountMinor: memberDiscount?.discountMinor ?? "0",
    payableMinor: normalizeMinorDigits(input.payableMinor),
    currency: input.currency.toUpperCase(),
    quoteSource: toContractSource(input.source),
    quoteStatus: toContractStatus(options.quoteStatus),
    ...(options.membershipDiscountBlocked === true
      ? { membershipDiscountBlocked: true }
      : {}),
    ...(options.memberPermanentDiscountPercentage !== undefined
      ? { memberPermanentDiscountPercentage: options.memberPermanentDiscountPercentage }
      : {}),
  };
}

export function mapQuoteVersionToCommercialPricingDisplay(
  quote: CommercialQuoteVersion,
  options: {
    readonly membershipDiscountBlocked?: boolean;
    readonly memberPermanentDiscountPercentage?: number | null;
  } = {}
): RegistrationCommercialPricingDisplay {
  const memberDiscount = quote.memberDiscount;
  return {
    grossMinor: normalizeMinorDigits(quote.grossMinor),
    memberDiscountPercentage: memberDiscount?.percentageApplied ?? null,
    memberDiscountMinor: memberDiscount?.discountMinor ?? "0",
    payableMinor: normalizeMinorDigits(quote.payableMinor),
    currency: quote.currency.toUpperCase(),
    quoteSource: toContractSource(quote.source),
    quoteStatus: toContractStatus(quote.status),
    ...(options.membershipDiscountBlocked === true
      ? { membershipDiscountBlocked: true }
      : {}),
    ...(options.memberPermanentDiscountPercentage !== undefined
      ? { memberPermanentDiscountPercentage: options.memberPermanentDiscountPercentage }
      : {}),
  };
}

export { hasAppliedRegistrationMemberDiscount as hasAppliedMemberDiscountDisplay } from "@app-tour/finance-http-contracts";
