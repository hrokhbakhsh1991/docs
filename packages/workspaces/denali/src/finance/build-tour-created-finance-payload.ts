/**
 * Build TourCreated finance payload fields from Denali commercial obligation.
 * Host still owns outbox persistence; this keeps pricing → ledger amount aligned.
 */

import {
  resolveDenaliRegistrationObligationMinor,
  type DenaliRegistrationObligation,
} from "./resolve-denali-registration-obligation";
import type { TourCreatedLedgerPayload } from "./handlers/tour-created-ledger";

export type BuildDenaliTourCreatedFinancePayloadInput = {
  readonly tourId: string;
  readonly registrationId: string;
  readonly tourCanonical: unknown;
  readonly partySize: number;
  readonly currency?: string;
};

export type BuildDenaliTourCreatedFinancePayloadResult = {
  readonly obligation: DenaliRegistrationObligation | null;
  readonly payload: TourCreatedLedgerPayload | null;
};

/**
 * When obligation resolves (offline_receipt), returns TourCreated ledger payload.
 * When commercial rules do not apply, payload is null (consumer will skip).
 */
export function buildDenaliTourCreatedFinancePayload(
  input: BuildDenaliTourCreatedFinancePayloadInput
): BuildDenaliTourCreatedFinancePayloadResult {
  const obligation = resolveDenaliRegistrationObligationMinor({
    tourCanonical: input.tourCanonical,
    partySize: input.partySize,
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
  });
  if (obligation === null) {
    return { obligation: null, payload: null };
  }
  return {
    obligation,
    payload: Object.freeze({
      tourId: input.tourId,
      registrationId: input.registrationId,
      paidAmountMinor: obligation.obligationMinor,
      currency: obligation.currency,
    }),
  };
}
