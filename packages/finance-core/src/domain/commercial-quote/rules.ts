/**
 * Pure Commercial Quote lifecycle rules (DEC-CQ-002, DEC-CQ-003, DEC-CQ-010).
 */

import type { CommercialQuoteVersion } from "./types";

/** Normalize positive minor-unit digit string; throws `COMMERCIAL_QUOTE_INVALID_MINOR`. */
export function assertCommercialQuoteMinor(raw: string, field: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) {
    throw new Error(`COMMERCIAL_QUOTE_INVALID_MINOR:${field}`);
  }
  return digits;
}

export function normalizeCommercialQuoteCurrency(raw: string): string {
  const normalized = raw.trim().toUpperCase();
  if (normalized.length === 0) {
    throw new Error("COMMERCIAL_QUOTE_INVALID_CURRENCY");
  }
  return normalized;
}

/** Latest non-superseded version; null when chain empty or all superseded. */
export function selectActiveCommercialQuote(
  chain: readonly CommercialQuoteVersion[]
): CommercialQuoteVersion | null {
  const candidates = chain.filter((row) => row.status !== "SUPERSEDED");
  if (candidates.length === 0) {
    return null;
  }
  return candidates.reduce((latest, row) =>
    row.versionNumber > latest.versionNumber ? row : latest
  );
}

export function isCommercialQuoteChainLocked(chain: readonly CommercialQuoteVersion[]): boolean {
  return chain.some((row) => row.status === "LOCKED");
}

/** Throws when chain has a LOCKED version (no new versions / supersede). */
export function assertCommercialQuoteChainNotLocked(chain: readonly CommercialQuoteVersion[]): void {
  if (isCommercialQuoteChainLocked(chain)) {
    throw new Error("COMMERCIAL_QUOTE_CHAIN_LOCKED");
  }
}

/** Commercial fields on a published version are immutable — compare snapshots for tests. */
export function commercialQuoteCommercialFieldsEqual(
  left: CommercialQuoteVersion,
  right: CommercialQuoteVersion
): boolean {
  return (
    left.grossMinor === right.grossMinor &&
    left.payableMinor === right.payableMinor &&
    left.currency === right.currency &&
    left.source === right.source &&
    left.calculationVersion === right.calculationVersion &&
    left.versionNumber === right.versionNumber &&
    left.supersedesVersionId === right.supersedesVersionId &&
    left.createdAt === right.createdAt &&
    left.tourId === right.tourId &&
    memberDiscountMetadataEqual(left.memberDiscount, right.memberDiscount)
  );
}

function memberDiscountMetadataEqual(
  left: CommercialQuoteVersion["memberDiscount"],
  right: CommercialQuoteVersion["memberDiscount"]
): boolean {
  if (left === undefined && right === undefined) {
    return true;
  }
  if (left === undefined || right === undefined) {
    return false;
  }
  return (
    left.percentageApplied === right.percentageApplied &&
    left.discountMinor === right.discountMinor &&
    left.memberUserId === right.memberUserId &&
    left.membershipReference === right.membershipReference
  );
}
