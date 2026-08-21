/**
 * Commercial Quote freeze input builder (CQ-2B).
 * Pure pipeline — no ports, Identity, or workspace imports.
 */

import {
  buildMemberDiscountQuoteMetadata,
  tryApplyMemberDiscountReducer,
  type MemberDiscountQuoteMetadata,
} from "./member-discount";
import {
  resolveLiveObligationDiscountableBaseMinor,
  resolveLiveObligationGrossMinor,
  type LiveRegistrationObligation,
} from "./map-obligation";
import type { CommercialQuoteSource, CreateCommercialQuoteVersionInput } from "./types";

export type CommercialQuotePaymentCollectionMode = "offline" | "free";

export type BuildCommercialQuoteFreezeInputArgs = {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly obligation: LiveRegistrationObligation;
  readonly paymentCollection: CommercialQuotePaymentCollectionMode;
  readonly memberUserId: string | null;
  readonly allowMembershipDiscount: boolean;
  readonly membershipDiscountPercentage: number | null | undefined;
  readonly createdAt?: string;
  readonly tourId?: string;
};

export type CommercialQuoteFreezeInput = CreateCommercialQuoteVersionInput & {
  readonly memberDiscount?: MemberDiscountQuoteMetadata;
};

export function buildCommercialQuoteFreezeInput(
  args: BuildCommercialQuoteFreezeInputArgs
): CommercialQuoteFreezeInput {
  const grossMinor = resolveLiveObligationGrossMinor(args.obligation);
  const currency = args.obligation.currency;
  const base = {
    tenantId: args.tenantId,
    registrationId: args.registrationId,
    grossMinor,
    currency,
    ...(args.createdAt !== undefined ? { createdAt: args.createdAt } : {}),
    ...(args.tourId !== undefined ? { tourId: args.tourId } : {}),
  };

  if (args.obligation.source === "operator_override") {
    return {
      ...base,
      payableMinor: args.obligation.obligationMinor.replace(/\D/g, ""),
      source: "operator_override",
    };
  }

  if (args.paymentCollection === "free") {
    return {
      ...base,
      payableMinor: "0",
      source: "free_collection",
    };
  }

  if (!args.allowMembershipDiscount || args.memberUserId === null) {
    return {
      ...base,
      payableMinor: grossMinor,
      source: "tour_canonical",
    };
  }

  const discountableBaseMinor = resolveLiveObligationDiscountableBaseMinor(args.obligation);
  const reduced = tryApplyMemberDiscountReducer({
    grossMinor: discountableBaseMinor,
    percentage: args.membershipDiscountPercentage,
  });
  if (reduced === null) {
    return {
      ...base,
      payableMinor: grossMinor,
      source: "tour_canonical",
    };
  }

  return {
    ...base,
    payableMinor: (BigInt(grossMinor) - BigInt(reduced.discountMinor)).toString(),
    source: "member_discount",
    memberDiscount: buildMemberDiscountQuoteMetadata({
      tenantId: args.tenantId,
      memberUserId: args.memberUserId,
      percentageApplied: reduced.percentageApplied,
      discountMinor: reduced.discountMinor,
    }),
  };
}

/** Idempotency check for freeze — includes member-discount metadata when applicable. */
export function commercialQuoteMatchesFreezeInput(
  quote: CommercialQuoteVersionLike,
  input: CommercialQuoteFreezeInput
): boolean {
  if (
    quote.grossMinor.replace(/\D/g, "") !== input.grossMinor.replace(/\D/g, "") ||
    quote.payableMinor.replace(/\D/g, "") !== input.payableMinor.replace(/\D/g, "") ||
    quote.currency.toUpperCase() !== input.currency.toUpperCase() ||
    quote.source !== input.source
  ) {
    return false;
  }

  if (input.source !== "member_discount") {
    return quote.memberDiscount === undefined && input.memberDiscount === undefined;
  }

  if (quote.memberDiscount === undefined || input.memberDiscount === undefined) {
    return false;
  }

  return (
    quote.memberDiscount.percentageApplied === input.memberDiscount.percentageApplied &&
    quote.memberDiscount.discountMinor === input.memberDiscount.discountMinor &&
    quote.memberDiscount.memberUserId === input.memberDiscount.memberUserId &&
    quote.memberDiscount.membershipReference === input.memberDiscount.membershipReference
  );
}

type CommercialQuoteVersionLike = {
  readonly grossMinor: string;
  readonly payableMinor: string;
  readonly currency: string;
  readonly source: CommercialQuoteSource;
  readonly memberDiscount?: MemberDiscountQuoteMetadata;
};
