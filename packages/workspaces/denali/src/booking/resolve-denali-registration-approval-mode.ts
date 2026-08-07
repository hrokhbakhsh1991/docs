/**
 * Pure Denali tour policy — public registration approval mode.
 * Missing / unknown → manual (safe default for screened club tours).
 */

export type DenaliRegistrationApprovalMode = "manual" | "auto";

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
 * Resolve `pricing.registrationApproval` from tour canonical.
 * Accepts either full canonical document (`{ data: {...} }`) or bare `data` object.
 */
export function resolveDenaliRegistrationApprovalMode(
  tourCanonical: unknown
): DenaliRegistrationApprovalMode {
  const data = asDataRoot(tourCanonical);
  if (data === null) {
    return "manual";
  }
  const raw =
    readCanonicalPath(data, "pricing.registrationApproval") ??
    readCanonicalPath(data, "pricingPayment.registrationApproval");
  if (typeof raw !== "string") {
    return "manual";
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "auto" ? "auto" : "manual";
}
