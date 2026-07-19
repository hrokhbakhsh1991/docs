/**
 * Path B exclusive emit — TourCreated paid ledger under registration wallet-credit lock.
 */
import {
  bookingWalletId,
  emitFinanceLedgerDoubleEntryAppliedOutbox,
  LEDGER_ACCOUNTS,
  postDoubleEntryJournal,
  stableLedgerIdentifiersFromSeed,
} from "@app-tour/workspace-denali";
import type { OutboxWriter } from "@app-tour/workspace-denali";

import { withTenantRls } from "../db/with-tenant-rls";
import { createTxScopedOutboxWriter } from "./infrastructure/prisma-workspace-outbox-writer";
import {
  advisoryLockRegistrationWalletCredit,
  registrationHasBookingWalletCredit,
} from "./registration-booking-wallet-credit";

export type TourCreatedPaidLedgerExclusiveInput = {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly paidAmountMinor: string;
  readonly currency: string;
  readonly tourCreatedDomainEventId: string;
};

export type TourCreatedPaidLedgerExclusiveResult = "emitted" | "skipped";

/**
 * Under pg_advisory_xact_lock: skip if Path A/B credit exists; else emit TourCreated ledger.
 * Payment capture domainEventIds are not modified.
 * Journal/line ids are seeded from TourCreated domainEventId (deterministic).
 */
export async function emitTourCreatedPaidLedgerExclusive(
  input: TourCreatedPaidLedgerExclusiveInput
): Promise<TourCreatedPaidLedgerExclusiveResult> {
  const registrationId = input.registrationId.trim();
  const paidAmountMinor = input.paidAmountMinor.trim();
  const tourCreatedDomainEventId = input.tourCreatedDomainEventId.trim();
  if (!registrationId || !paidAmountMinor || !tourCreatedDomainEventId) {
    return "skipped";
  }

  return withTenantRls(input.tenantId, async (tx) => {
    await advisoryLockRegistrationWalletCredit(tx, input.tenantId, registrationId);
    if (await registrationHasBookingWalletCredit(tx, input.tenantId, registrationId)) {
      return "skipped";
    }

    const currency = input.currency.trim() || "USD";
    const stableIds = stableLedgerIdentifiersFromSeed(
      tourCreatedDomainEventId,
      "tour-created-ledger"
    );
    const { lines } = postDoubleEntryJournal({
      tenantId: input.tenantId,
      debitAccount: LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING,
      creditAccount: bookingWalletId(registrationId),
      amount_minor: paidAmountMinor,
      currency,
      correlationId: tourCreatedDomainEventId,
      idempotencyKey: `tour-created:${tourCreatedDomainEventId}`,
      stableJournalAndLineIds: stableIds,
      metadata: {
        kind: "tour_created_paid_settlement",
        registrationId,
        source: "tour_created",
      },
    });

    const writer = createTxScopedOutboxWriter(tx);
    await emitFinanceLedgerDoubleEntryAppliedOutbox({
      outboxWriter: writer as unknown as OutboxWriter,
      tenantId: input.tenantId,
      registrationId,
      lines,
    });
    return "emitted";
  });
}
