/**
 * Pure Denali commercial obligation — tour pricing × party size + transport add-ons.
 * Host loads booking + tour canonical; this module stays free of apps/api imports.
 *
 * Due total must match catalog intake `estimateDenaliRegistrationPricePerPerson`
 * (trip + organized transport cost + dong when kind is no_car_dong).
 */

import { isPublicCatalogOrganizedTransportMode } from "@app-tour/workspace-sdk";

import { readDenaliCatalogTransportSnapshot } from "../catalog/read-denali-catalog-transport";
import { resolveDenaliPaymentCollectionMode } from "./resolve-denali-payment-collection-mode";
import { unwrapDenaliTourCanonicalDocument } from "./unwrap-denali-tour-canonical-document";

type TransportKind = "primary" | "personal_car" | "no_car_dong" | "no_car_acquaintance";

const TRANSPORT_KINDS = new Set<string>([
  "primary",
  "personal_car",
  "no_car_dong",
  "no_car_acquaintance",
]);

export type DenaliRegistrationDueLineCode = "trip" | "dong" | "transport";

export type DenaliRegistrationDueLine = {
  readonly code: DenaliRegistrationDueLineCode;
  readonly amountMinor: string;
};

export type DenaliRegistrationObligation = {
  readonly currency: string;
  readonly obligationMinor: string;
  readonly source: "tour_canonical" | "unknown";
  readonly lines: readonly DenaliRegistrationDueLine[];
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

function readTransportKind(registrationIntake: unknown): TransportKind {
  if (registrationIntake === null || typeof registrationIntake !== "object") {
    return "primary";
  }
  const transport = (registrationIntake as Record<string, unknown>).transport;
  if (transport === null || typeof transport !== "object") {
    return "primary";
  }
  const kind = (transport as Record<string, unknown>).kind;
  if (typeof kind === "string" && TRANSPORT_KINDS.has(kind)) {
    return kind as TransportKind;
  }
  return "primary";
}

/** Mirrors catalog/http estimate — kept here to avoid finance→http import cycles. */
function estimatePerPerson(input: {
  readonly basePrice: number;
  readonly transport: ReturnType<typeof readDenaliCatalogTransportSnapshot>;
  readonly kind: TransportKind;
}): number {
  const transportCost = input.transport.transportCostAmount ?? 0;
  const dongAmount = input.transport.dongAmount ?? 0;
  switch (input.kind) {
    case "primary":
      if (isPublicCatalogOrganizedTransportMode(input.transport.mode)) {
        return input.basePrice + transportCost;
      }
      return input.basePrice;
    case "personal_car":
    case "no_car_acquaintance":
      return input.basePrice;
    case "no_car_dong":
      return input.basePrice + dongAmount;
    default:
      return input.basePrice;
  }
}

function scaleMinor(perPerson: number, partySize: number): string {
  return (BigInt(perPerson) * BigInt(partySize)).toString();
}

/**
 * Transport-aware due breakdown for member display + Finance obligation.
 */
export function resolveDenaliRegistrationDueBreakdown(input: {
  readonly tourCanonical: unknown;
  readonly partySize: number;
  readonly currency?: string;
  readonly registrationIntake?: unknown;
}): DenaliRegistrationObligation | null {
  if (!Number.isFinite(input.partySize) || input.partySize < 1) {
    return null;
  }

  const data = unwrapDenaliTourCanonicalDocument(input.tourCanonical);
  if (data === null) {
    return null;
  }

  const currency = (input.currency ?? "IRR").toUpperCase();

  if (resolveDenaliPaymentCollectionMode(input.tourCanonical) === "free") {
    return {
      currency,
      obligationMinor: "0",
      source: "tour_canonical",
      lines: [],
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

  const transport = readDenaliCatalogTransportSnapshot(data);
  const kind = readTransportKind(input.registrationIntake);
  const perPerson = estimatePerPerson({
    basePrice: basePerPerson,
    transport,
    kind,
  });
  if (perPerson <= 0) {
    return null;
  }

  const lines: DenaliRegistrationDueLine[] = [
    { code: "trip", amountMinor: scaleMinor(basePerPerson, input.partySize) },
  ];

  const addOnPerPerson = perPerson - basePerPerson;
  if (addOnPerPerson > 0) {
    if (kind === "no_car_dong") {
      lines.push({ code: "dong", amountMinor: scaleMinor(addOnPerPerson, input.partySize) });
    } else {
      lines.push({ code: "transport", amountMinor: scaleMinor(addOnPerPerson, input.partySize) });
    }
  }

  return {
    currency,
    obligationMinor: scaleMinor(perPerson, input.partySize),
    source: "tour_canonical",
    lines,
  };
}

export function resolveDenaliRegistrationObligationMinor(input: {
  readonly tourCanonical: unknown;
  readonly partySize: number;
  readonly currency?: string;
  readonly registrationIntake?: unknown;
}): DenaliRegistrationObligation | null {
  return resolveDenaliRegistrationDueBreakdown(input);
}
