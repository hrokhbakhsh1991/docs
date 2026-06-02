import type { EntityManager } from "typeorm";

import type { OutboxService } from "../../outbox/outbox.service";
import { bookingWalletId } from "./booking-ledger-authority.service";
import { LEDGER_ACCOUNTS } from "./ledger-accounts";
import { emitFinanceLedgerDoubleEntryAppliedOutbox } from "./emit-finance-ledger-journal-outbox";
import { postDoubleEntryJournal } from "./post-double-entry-journal";

export type ReconciliationOperatorLedgerFlow = "credit_booking_wallet" | "debit_booking_wallet";

/**
 * Posts a balanced **operator reconciliation** journal (clearing ↔ booking wallet) and enqueues
 * `finance.ledger.double_entry_applied`, which triggers {@link isFinancialOutboxEventType} → mandatory
 * `tenant_audit_events` row via {@link OutboxService.addEvent}.
 */
export async function emitReconciliationOperatorLedgerAdjustment(input: {
  manager: EntityManager;
  outboxService: OutboxService;
  tenantId: string;
  registrationId: string;
  currency: string;
  amountMinor: string;
  flow: ReconciliationOperatorLedgerFlow;
  idempotencyKey: string;
  findingId: string;
  operatorNote: string;
}): Promise<{ journalId: string }> {
  const tenantId = input.tenantId.trim().toLowerCase();
  const booking = bookingWalletId(input.registrationId.trim());
  const correlationId = `reconciliation:operator:${input.findingId}:${input.idempotencyKey.trim()}`.slice(0, 250);
  const baseKey = input.idempotencyKey.trim();
  const domainEventId = `reconciliation.adjustment:${input.findingId}:${baseKey}`.slice(0, 128);

  const meta = {
    source: "reconciliation_operator_adjustment",
    finding_id: input.findingId,
    registration_id: input.registrationId.trim(),
    operator_note: input.operatorNote.trim().slice(0, 2000)
  };

  let debitAccount: string;
  let creditAccount: string;
  if (input.flow === "credit_booking_wallet") {
    debitAccount = LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING;
    creditAccount = booking;
  } else {
    debitAccount = booking;
    creditAccount = LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING;
  }

  const result = postDoubleEntryJournal({
    tenantId,
    debitAccount,
    creditAccount,
    amount_minor: input.amountMinor.trim(),
    currency: input.currency.trim().toUpperCase().slice(0, 3),
    correlationId,
    idempotencyKey: `${baseKey}:reconciliation_adjustment`,
    metadata: meta
  });

  await emitFinanceLedgerDoubleEntryAppliedOutbox({
    manager: input.manager,
    outboxService: input.outboxService,
    tenantId,
    registrationId: input.registrationId.trim(),
    lines: result.lines,
    domainEventIdOverride: domainEventId
  });

  return { journalId: result.journalId };
}
