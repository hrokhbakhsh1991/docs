/**
 * Commercial Quote domain types (DEC-CQ-001..013).
 * Pure value objects — no persistence or Prisma shapes.
 */

import type { MemberDiscountQuoteMetadata } from "./member-discount";

export const COMMERCIAL_QUOTE_SOURCES = [
  "tour_canonical",
  "operator_override",
  "free_collection",
  "member_discount",
] as const;

export type CommercialQuoteSource = (typeof COMMERCIAL_QUOTE_SOURCES)[number];

export const COMMERCIAL_QUOTE_STATUSES = ["FROZEN", "SUPERSEDED", "LOCKED"] as const;

export type CommercialQuoteStatus = (typeof COMMERCIAL_QUOTE_STATUSES)[number];

/** Default formula semver for Phase 1 foundation (no member discount). */
export const COMMERCIAL_QUOTE_CALCULATION_VERSION = "quote-v1" as const;

/**
 * Immutable commercial quote version for one registration at one freeze point.
 */
export type CommercialQuoteVersion = {
  readonly id: string;
  readonly tenantId: string;
  readonly registrationId: string;
  readonly versionNumber: number;
  readonly status: CommercialQuoteStatus;
  readonly grossMinor: string;
  readonly payableMinor: string;
  readonly currency: string;
  readonly source: CommercialQuoteSource;
  readonly calculationVersion: string;
  readonly supersedesVersionId: string | null;
  readonly createdAt: string;
  readonly tourId?: string;
  readonly memberDiscount?: MemberDiscountQuoteMetadata;
};

export type CreateCommercialQuoteVersionInput = {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly grossMinor: string;
  readonly payableMinor: string;
  readonly currency: string;
  readonly source: CommercialQuoteSource;
  readonly calculationVersion?: string;
  readonly supersedesVersionId?: string | null;
  readonly createdAt?: string;
  readonly tourId?: string;
  readonly memberDiscount?: MemberDiscountQuoteMetadata;
};
