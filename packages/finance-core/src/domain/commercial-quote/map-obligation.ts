/**
 * Map live obligation resolution → commercial quote freeze input (CQ-1B / CQ-1D).
 * No Denali / workspace imports — consumes FinanceRegistrationObligation shape only.
 */

import { isZeroObligationMinor } from "../obligation-override";
import type { CommercialQuoteSource, CreateCommercialQuoteVersionInput } from "./types";

export type LiveRegistrationObligation = {
  readonly currency: string;
  readonly obligationMinor: string;
  readonly grossObligationMinor?: string;
  readonly source: "tour_canonical" | "schedule" | "operator_override" | "unknown";
};

function normalizeMinor(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function resolveLiveObligationGrossMinor(obligation: LiveRegistrationObligation): string {
  const gross = obligation.grossObligationMinor ?? obligation.obligationMinor;
  return normalizeMinor(gross);
}

export function mapLiveObligationSourceToQuoteSource(
  obligation: LiveRegistrationObligation
): CommercialQuoteSource {
  if (obligation.source === "operator_override") {
    return "operator_override";
  }
  if (isZeroObligationMinor(obligation.obligationMinor)) {
    return "free_collection";
  }
  return "tour_canonical";
}

/** Maps workspace obligation → quote freeze input; gross and payable may diverge (CQ-1D). */
export function mapLiveObligationToQuoteInput(input: {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly obligation: LiveRegistrationObligation;
  readonly createdAt?: string;
}): CreateCommercialQuoteVersionInput {
  const payableMinor = normalizeMinor(input.obligation.obligationMinor);
  const grossMinor = resolveLiveObligationGrossMinor(input.obligation);
  return {
    tenantId: input.tenantId,
    registrationId: input.registrationId,
    grossMinor,
    payableMinor,
    currency: input.obligation.currency,
    source: mapLiveObligationSourceToQuoteSource(input.obligation),
    ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
  };
}

export function liveObligationMatchesQuoteVersion(
  obligation: LiveRegistrationObligation,
  quote: {
    readonly grossMinor: string;
    readonly payableMinor: string;
    readonly currency: string;
    readonly source: CommercialQuoteSource;
  }
): boolean {
  const mappedSource = mapLiveObligationSourceToQuoteSource(obligation);
  return (
    normalizeMinor(quote.payableMinor) === normalizeMinor(obligation.obligationMinor) &&
    normalizeMinor(quote.grossMinor) === resolveLiveObligationGrossMinor(obligation) &&
    quote.currency.toUpperCase() === obligation.currency.toUpperCase() &&
    quote.source === mappedSource
  );
}
