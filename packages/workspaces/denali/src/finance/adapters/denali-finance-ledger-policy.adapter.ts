import type {
  BuildPaymentCaptureJournalInput,
  BuildPrepaymentJournalInput,
  FinanceLedgerCapturePlan,
  FinanceLedgerPolicyPort,
} from "@app-tour/finance-http-contracts";

import { bookingWalletId, LEDGER_ACCOUNTS } from "../ledger-accounts";
import {
  postDoubleEntryJournal,
  stableLedgerIdentifiersFromSeed,
} from "../post-double-entry-journal";

/**
 * Denali workspace ledger policy adapter — owns CoA posting via Denali ledger helpers.
 * Capture domainEventId formulas are platform-stable (unchanged from API-hosted adapter).
 */
export class DenaliFinanceLedgerPolicyAdapter implements FinanceLedgerPolicyPort {
  buildPaymentCaptureJournal(input: BuildPaymentCaptureJournalInput): FinanceLedgerCapturePlan {
    const stableIds = stableLedgerIdentifiersFromSeed(input.paymentId, "payment-ledger");
    const { journalId, lines } = postDoubleEntryJournal({
      tenantId: input.tenantId,
      debitAccount: LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING,
      creditAccount: bookingWalletId(input.registrationId),
      amount_minor: input.amountMinor,
      currency: input.currency,
      correlationId: `payment:${input.paymentId}:capture`,
      idempotencyKey: `payment:${input.paymentId}:capture-anchor`,
      stableJournalAndLineIds: stableIds,
      journalLinesCreatedAtIso: input.capturedAtIso,
      metadata: {
        kind: "payment_capture_at_paid",
        source: "manual_receipt_approve",
        paymentId: input.paymentId,
        registrationId: input.registrationId,
      },
    });
    return {
      journalId,
      domainEventId: `payment:${input.paymentId}:ledger-capture-anchor`,
      lines,
    };
  }

  buildPrepaymentJournal(input: BuildPrepaymentJournalInput): FinanceLedgerCapturePlan {
    const stableIds = stableLedgerIdentifiersFromSeed(input.journalSeed, "payment-ledger");
    const { journalId, lines } = postDoubleEntryJournal({
      tenantId: input.tenantId,
      debitAccount: LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING,
      creditAccount: bookingWalletId(input.registrationId),
      amount_minor: input.amountMinor,
      currency: input.currency,
      correlationId: input.prepaymentDomainEventId,
      idempotencyKey: input.prepaymentDomainEventId,
      stableJournalAndLineIds: stableIds,
      journalLinesCreatedAtIso: input.recordedAtIso,
      metadata: {
        kind: "registration_prepayment_received",
        registrationId: input.registrationId,
        method: input.method,
        clientOperationKeyHash: input.keyHash,
      },
    });
    return {
      journalId,
      domainEventId: input.ledgerDomainEventId,
      lines,
    };
  }
}
