/**
 * Pure Denali commercial obligation — tour canonical pricing × party size (FC-2).
 * Host loads booking + tour canonical; this module stays free of apps/api imports.
 */

import { resolveDenaliPaymentCollectionMode } from "./resolve-denali-payment-collection-mode";

export type DenaliRegistrationObligation = {
  readonly currency: string;
  readonly obligationMinor: string;
  readonly source: "tour_canonical" | "unknown";
};

function readCanonicalPath(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== "object") {
      return undefined;
    }
    return (acc as Record<string, unknown>)[key];
  }, data);
}

function readInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value.replace(/\D/g, ""), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function resolveDenaliRegistrationObligationMinor(input: {
  readonly tourCanonical: unknown;
  readonly partySize: number;
  readonly currency?: string;
}): DenaliRegistrationObligation | null {
  if (!Number.isFinite(input.partySize) || input.partySize < 1) {
    return null;
  }
  const data =
    input.tourCanonical !== null &&
    typeof input.tourCanonical === "object" &&
    !Array.isArray(input.tourCanonical)
      ? (input.tourCanonical as Record<string, unknown>)
      : null;
  if (data === null) {
    return null;
  }

  const currency = (input.currency ?? "IRR").toUpperCase();

  // Phase 4 — free collection: zero obligation (never fall back to offline receipt defaults).
  if (resolveDenaliPaymentCollectionMode(input.tourCanonical) === "free") {
    return {
      currency,
      obligationMinor: "0",
      source: "tour_canonical",
    };
  }

  const paymentMode = String(
    readCanonicalPath(data, "pricing.paymentMode") ??
      readCanonicalPath(data, "pricingPayment.paymentMode") ??
      ""
  ).trim();
  if (paymentMode.length > 0 && paymentMode !== "offline_receipt") {
    return null;
  }

  const basePerPerson = readInteger(readCanonicalPath(data, "pricing.basePricePerPerson"));
  if (basePerPerson === null || basePerPerson <= 0) {
    return null;
  }

  const totalMinor = BigInt(basePerPerson) * BigInt(input.partySize);
  return {
    currency,
    obligationMinor: totalMinor.toString(),
    source: "tour_canonical",
  };
}
