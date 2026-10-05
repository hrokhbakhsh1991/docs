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
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    return normalized === "free" ? "free" : "offline";
  }

  // The wizard's persisted source of truth is `requiresPayment`; older
  // records may not have the derived paymentCollection field yet.
  const requiresPayment =
    readCanonicalPath(data, "pricing.requiresPayment") ??
    readCanonicalPath(data, "pricingPayment.requiresPayment");
  if (requiresPayment === false) {
    return "free";
  }
  if (typeof requiresPayment === "string" && requiresPayment.trim().toLowerCase() === "false") {
    return "free";
  }
  return "offline";
}
