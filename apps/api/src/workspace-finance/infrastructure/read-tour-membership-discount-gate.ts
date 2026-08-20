/**
 * Read tour canonical `allowMembershipDiscount` gate (DEC-CQ-011).
 * Workspace-agnostic JSON walk — defaults false when missing.
 */
export function readTourAllowMembershipDiscount(tourCanonical: unknown): boolean {
  const document = unwrapCanonicalDocument(tourCanonical);
  if (document === null) {
    return false;
  }

  const pricing = readRecord(document.pricing) ?? readRecord(document.pricingPayment);
  if (pricing !== null && pricing.allowMembershipDiscount === true) {
    return true;
  }

  const nested = readRecord(document.data);
  if (nested !== null) {
    const nestedPricing = readRecord(nested.pricing) ?? readRecord(nested.pricingPayment);
    if (nestedPricing !== null && nestedPricing.allowMembershipDiscount === true) {
      return true;
    }
  }

  return false;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
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
