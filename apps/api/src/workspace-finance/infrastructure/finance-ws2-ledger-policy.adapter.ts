import { createHash, randomUUID } from "node:crypto";

import {
  FINANCE_WS2_LEDGER_ACCOUNTS,
  financeWs2BookingWalletId,
} from "./finance-ws2-chart-of-accounts";
import type {
  BuildPaymentCaptureJournalInput,
  BuildPrepaymentJournalInput,
  FinanceLedgerCapturePlan,
  FinanceLedgerJournalLine,
  FinanceLedgerPolicyPort,
} from "../ports/finance-ledger-policy.port";

/**
 * Fake WS2 ledger policy — owns CoA posting; does not import Denali finance helpers.
 * Phase 3B capture domainEventId formula stays host-stable (same as Denali adapter).
 */
export class FinanceWs2LedgerPolicyAdapter implements FinanceLedgerPolicyPort {
  buildPaymentCaptureJournal(input: BuildPaymentCaptureJournalInput): FinanceLedgerCapturePlan {
    const stableIds = stableLedgerIdentifiers(input.paymentId);
    const { journalId, lines } = postWs2DoubleEntry({
      tenantId: input.tenantId,
      debitAccount: FINANCE_WS2_LEDGER_ACCOUNTS.OPERATOR_CASH_CLEARING,
      creditAccount: financeWs2BookingWalletId(input.registrationId),
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
        workspaceFinancePlugin: "finance-ws2",
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
    const { journalId, lines } = postWs2DoubleEntry({
      tenantId: input.tenantId,
      debitAccount: FINANCE_WS2_LEDGER_ACCOUNTS.OPERATOR_CASH_CLEARING,
      creditAccount: financeWs2BookingWalletId(input.registrationId),
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
        workspaceFinancePlugin: "finance-ws2",
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

function stableLedgerIdentifiers(seed: string): {
  journalId: string;
  debitLineId: string;
  creditLineId: string;
} {
  const id = seed.trim();
  return {
    journalId: deterministicUuidFromSeed(`ws2-payment-ledger:journal:${id}`),
    debitLineId: deterministicUuidFromSeed(`ws2-payment-ledger:debit:${id}`),
    creditLineId: deterministicUuidFromSeed(`ws2-payment-ledger:credit:${id}`),
  };
}

/** WS2-owned balanced double-entry materializer (not Denali `postDoubleEntryJournal`). */
function postWs2DoubleEntry(input: {
  tenantId: string;
  debitAccount: string;
  creditAccount: string;
  amount_minor: string;
  currency: string;
  correlationId: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  stableJournalAndLineIds: {
    journalId: string;
    debitLineId: string;
    creditLineId: string;
  };
  journalLinesCreatedAtIso: string;
}): { journalId: string; lines: readonly FinanceLedgerJournalLine[] } {
  const tenantId = input.tenantId.trim();
  const debitAccount = input.debitAccount.trim();
  const creditAccount = input.creditAccount.trim();
  if (!tenantId || !debitAccount || !creditAccount) {
    throw new Error("FINANCE_WS2_LEDGER_REQUIRED: tenantId and accounts are required");
  }
  if (debitAccount === creditAccount) {
    throw new Error("FINANCE_WS2_LEDGER_ACCOUNTS_DISTINCT: debitAccount !== creditAccount");
  }
  if (!/^\d+$/.test(input.amount_minor.trim()) || BigInt(input.amount_minor.trim()) <= 0n) {
    throw new Error("FINANCE_WS2_LEDGER_AMOUNT_INVALID: amount_minor must be a positive integer string");
  }
  const amountStr = input.amount_minor.trim();
  const currency = input.currency.trim();
  const journalId = input.stableJournalAndLineIds.journalId || randomUUID();
  const createdAt = input.journalLinesCreatedAtIso;

  const debitLine: FinanceLedgerJournalLine = {
    id: input.stableJournalAndLineIds.debitLineId,
    journalId,
    tenantId,
    account: debitAccount,
    side: "debit",
    amount_minor: amountStr,
    currency,
    correlationId: `${input.correlationId}:debit`,
    idempotencyKey: `${input.idempotencyKey}:debit`,
    createdAt,
    metadata: input.metadata,
  };
  const creditLine: FinanceLedgerJournalLine = {
    id: input.stableJournalAndLineIds.creditLineId,
    journalId,
    tenantId,
    account: creditAccount,
    side: "credit",
    amount_minor: amountStr,
    currency,
    correlationId: `${input.correlationId}:credit`,
    idempotencyKey: `${input.idempotencyKey}:credit`,
    createdAt,
    metadata: input.metadata,
  };
  return { journalId, lines: [debitLine, creditLine] };
}
