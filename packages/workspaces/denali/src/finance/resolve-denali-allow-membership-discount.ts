/**
 * Denali tour policy — membership discount gate at quote freeze (DEC-CQ-011 / CQ-2D).
 */
import { unwrapDenaliTourCanonicalDocument } from "./unwrap-denali-tour-canonical-document";

function readCanonicalPath(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== "object") {
      return undefined;
    }
    return (acc as Record<string, unknown>)[key];
  }, data);
}

/**
 * Resolve `pricing.allowMembershipDiscount` from Denali tour canonical.
 * Missing / false → false (fail closed). Finance still requires Identity fact.
 */
export function resolveDenaliAllowMembershipDiscount(tourCanonical: unknown): boolean {
  const data = unwrapDenaliTourCanonicalDocument(tourCanonical);
  if (data === null) {
    return false;
  }

  const raw =
    readCanonicalPath(data, "pricing.allowMembershipDiscount") ??
    readCanonicalPath(data, "pricingPayment.allowMembershipDiscount");
  return raw === true;
}
