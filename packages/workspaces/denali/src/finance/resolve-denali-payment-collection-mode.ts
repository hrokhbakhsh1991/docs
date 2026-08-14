/**
 * Pure Denali tour policy — how money is collected after registration approval.
 * Missing / unknown → offline (safe default: approve-then-receipt).
 */

import { unwrapDenaliTourCanonicalDocument } from "./unwrap-denali-tour-canonical-document";

export type DenaliPaymentCollectionMode = "offline" | "free";

function readCanonicalPath(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== "object" || Array.isArray(acc)) {
      return undefined;
    }
    return (acc as Record<string, unknown>)[key];
  }, data);
}

/**
 * Resolve `pricing.paymentCollection` from tour canonical.
 * Accepts either full canonical document (`{ data: {...} }`) or bare `data` object.
 */
export function resolveDenaliPaymentCollectionMode(
  tourCanonical: unknown
): DenaliPaymentCollectionMode {
  const data = unwrapDenaliTourCanonicalDocument(tourCanonical);
  if (data === null) {
    return "offline";
  }
  const raw =
    readCanonicalPath(data, "pricing.paymentCollection") ??
    readCanonicalPath(data, "pricingPayment.paymentCollection");
  if (typeof raw !== "string") {
    return "offline";
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "free" ? "free" : "offline";
}
