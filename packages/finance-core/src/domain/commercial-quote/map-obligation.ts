/**
 * Map live obligation resolution → commercial quote freeze input (CQ-1B Phase 1).
 * No Denali / workspace imports — consumes FinanceRegistrationObligation shape only.
 */

import { isZeroObligationMinor } from "../obligation-override";
import type { CommercialQuoteSource, CreateCommercialQuoteVersionInput } from "./types";

export type LiveRegistrationObligation = {
  readonly currency: string;
  readonly obligationMinor: string;
  readonly source: "tour_canonical" | "schedule" | "operator_override" | "unknown";
};

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

/** Phase 1 — gross equals payable until member-discount reducer lands. */
export function mapLiveObligationToQuoteInput(input: {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly obligation: LiveRegistrationObligation;
  readonly createdAt?: string;
}): CreateCommercialQuoteVersionInput {
  const payableMinor = input.obligation.obligationMinor.replace(/\D/g, "");
  return {
    tenantId: input.tenantId,
    registrationId: input.registrationId,
    grossMinor: payableMinor,
    payableMinor,
    currency: input.obligation.currency,
    source: mapLiveObligationSourceToQuoteSource(input.obligation),
    ...(input.createdAt !== undefined ? { createdAt: input.createdAt } : {}),
  };
}

export function liveObligationMatchesQuoteVersion(
  obligation: LiveRegistrationObligation,
  quote: {
    readonly payableMinor: string;
    readonly currency: string;
    readonly source: CommercialQuoteSource;
  }
): boolean {
  const mappedSource = mapLiveObligationSourceToQuoteSource(obligation);
  return (
    quote.payableMinor.replace(/\D/g, "") === obligation.obligationMinor.replace(/\D/g, "") &&
    quote.currency.toUpperCase() === obligation.currency.toUpperCase() &&
    quote.source === mappedSource
  );
}
