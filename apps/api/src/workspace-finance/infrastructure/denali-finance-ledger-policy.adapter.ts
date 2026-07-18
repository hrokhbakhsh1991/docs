import { createHash } from "node:crypto";

import {
  bookingWalletId,
  LEDGER_ACCOUNTS,
  postDoubleEntryJournal,
} from "@app-tour/workspace-denali";

import type {
  BuildPaymentCaptureJournalInput,
  BuildPrepaymentJournalInput,
  FinanceLedgerCapturePlan,
  FinanceLedgerPolicyPort,
} from "../ports/finance-ledger-policy.port";

/**
 * Denali workspace ledger policy adapter — sole workspace-finance importer of
 * LEDGER_ACCOUNTS / bookingWalletId / postDoubleEntryJournal.
 */
export class DenaliFinanceLedgerPolicyAdapter implements FinanceLedgerPolicyPort {
  buildPaymentCaptureJournal(input: BuildPaymentCaptureJournalInput): FinanceLedgerCapturePlan {
    const stableIds = stableLedgerIdentifiers(input.paymentId);
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
    const stableIds = stableLedgerIdentifiers(input.journalSeed);
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

function deterministicUuidFromSeed(seed: string): string {
  const hash = createHash("sha256").update(seed, "utf8").digest();
  const buf = Buffer.alloc(16);
  hash.copy(buf, 0, 0, 16);
  buf[6] = (buf[6]! & 0x0f) | 0x40;
  buf[8] = (buf[8]! & 0x3f) | 0x80;
  const hex = buf.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Preserves prior FinanceService stablePaymentCaptureLedgerIdentifiers seeding. */
function stableLedgerIdentifiers(seed: string): {
  journalId: string;
  debitLineId: string;
  creditLineId: string;
} {
  const id = seed.trim();
  return {
    journalId: deterministicUuidFromSeed(`payment-ledger:journal:${id}`),
    debitLineId: deterministicUuidFromSeed(`payment-ledger:debit:${id}`),
    creditLineId: deterministicUuidFromSeed(`payment-ledger:credit:${id}`),
  };
}
