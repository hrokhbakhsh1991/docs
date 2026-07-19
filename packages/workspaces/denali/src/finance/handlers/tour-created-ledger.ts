import { emitFinanceLedgerDoubleEntryAppliedOutbox } from "../emit-finance-ledger-journal-outbox";
import { LEDGER_ACCOUNTS, bookingWalletId } from "../ledger-accounts";
import type { DenaliOutboxDomainEvent } from "../outbox-reader.port";
import type { OutboxWriter } from "../outbox-writer.port";
import {
  postDoubleEntryJournal,
  stableLedgerIdentifiersFromSeed,
} from "../post-double-entry-journal";

export type TourCreatedLedgerPayload = {
  tourId?: string;
  registrationId?: string;
  paidAmountMinor?: string;
  currency?: string;
};

export async function handleTourCreatedLedgerEvent(input: {
  tenantId: string;
  event: DenaliOutboxDomainEvent;
  outboxWriter: OutboxWriter;
}): Promise<boolean> {
  if (input.event.eventType !== "TourCreated") {
    return false;
  }

  const payload = input.event.payload as TourCreatedLedgerPayload;
  const registrationId = payload.registrationId?.trim();
  const paidAmountMinor = payload.paidAmountMinor?.trim();
  if (!registrationId || !paidAmountMinor) {
    return false;
  }

  const currency = payload.currency?.trim() || "USD";
  const stableIds = stableLedgerIdentifiersFromSeed(
    input.event.domainEventId,
    "tour-created-ledger"
  );
  const { lines } = postDoubleEntryJournal({
    tenantId: input.tenantId,
    debitAccount: LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING,
    creditAccount: bookingWalletId(registrationId),
    amount_minor: paidAmountMinor,
    currency,
    correlationId: input.event.domainEventId,
    idempotencyKey: `tour-created:${input.event.domainEventId}`,
    stableJournalAndLineIds: stableIds,
    metadata: {
      kind: "tour_created_paid_settlement",
      registrationId,
      source: "tour_created",
    },
  });

  await emitFinanceLedgerDoubleEntryAppliedOutbox({
    outboxWriter: input.outboxWriter,
    tenantId: input.tenantId,
    registrationId,
    lines,
  });

  return true;
}
