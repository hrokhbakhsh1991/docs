/**
 * Read tour canonical `allowMembershipDiscount` gate (DEC-CQ-011 / CQ-2D).
 * Workspace-agnostic JSON walk — fail closed when missing.
 */

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readAllowMembershipDiscountFromPricing(pricing: Record<string, unknown> | null): boolean {
  if (pricing === null) {
    return false;
  }
  const raw = pricing.allowMembershipDiscount;
  return raw === true || raw === "true";
}

function unwrapCanonicalDocument(tourCanonical: unknown): Record<string, unknown> | null {
  if (tourCanonical === null || typeof tourCanonical !== "object" || Array.isArray(tourCanonical)) {
    return null;
  }
  const record = tourCanonical as Record<string, unknown>;
  if (record.data !== undefined) {
    return readRecord(record.data);
  }
  return record;
}

/**
 * Returns true only when tour canonical explicitly enables membership discounts.
 * Missing / false / non-boolean → false (fail closed).
 */
export function readTourAllowMembershipDiscount(tourCanonical: unknown): boolean {
  const document = unwrapCanonicalDocument(tourCanonical);
  if (document === null) {
    return false;
  }

  if (
    readAllowMembershipDiscountFromPricing(readRecord(document.pricing)) ||
    readAllowMembershipDiscountFromPricing(readRecord(document.pricingPayment))
  ) {
    return true;
  }

  const nested = readRecord(document.data);
  if (nested !== null) {
    return (
      readAllowMembershipDiscountFromPricing(readRecord(nested.pricing)) ||
      readAllowMembershipDiscountFromPricing(readRecord(nested.pricingPayment))
    );
  }

  return false;
}
