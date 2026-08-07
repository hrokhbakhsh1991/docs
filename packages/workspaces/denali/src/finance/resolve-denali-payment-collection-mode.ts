/**
 * Pure Denali tour policy — how money is collected after registration approval.
 * Missing / unknown → offline (safe default: approve-then-receipt).
 */

export type DenaliPaymentCollectionMode = "offline" | "free";

function readCanonicalPath(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== "object" || Array.isArray(acc)) {
      return undefined;
    }
    return (acc as Record<string, unknown>)[key];
  }, data);
}

function asDataRoot(tourCanonical: unknown): Record<string, unknown> | null {
  if (tourCanonical === null || typeof tourCanonical !== "object" || Array.isArray(tourCanonical)) {
    return null;
  }
  const root = tourCanonical as Record<string, unknown>;
  const nested = root.data;
  if (nested !== null && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return root;
}

/**
 * Resolve `pricing.paymentCollection` from tour canonical.
 * Accepts either full canonical document (`{ data: {...} }`) or bare `data` object.
 */
export function resolveDenaliPaymentCollectionMode(
  tourCanonical: unknown
): DenaliPaymentCollectionMode {
  const data = asDataRoot(tourCanonical);
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
