import { createHash } from "node:crypto";

import type {
  BuildPaymentCaptureJournalInput,
  BuildPrepaymentJournalInput,
  FinanceLedgerCapturePlan,
  FinanceLedgerJournalLine,
  FinanceLedgerPolicyPort,
} from "@app-tour/finance-http-contracts";

import { ALPINE_LEDGER_ACCOUNTS, alpineBookingWalletId } from "./chart-of-accounts";

export class AlpineLedgerPolicyAdapter implements FinanceLedgerPolicyPort {
  buildPaymentCaptureJournal(input: BuildPaymentCaptureJournalInput): FinanceLedgerCapturePlan {
    return buildAlpineJournal({
      seed: `payment:${input.paymentId}`,
      tenantId: input.tenantId,
      registrationId: input.registrationId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      createdAtIso: input.capturedAtIso,
      metadata: Object.freeze({ workspaceFinancePlugin: "alpine", kind: "payment_capture" }),
    });
  }

  buildPrepaymentJournal(input: BuildPrepaymentJournalInput): FinanceLedgerCapturePlan {
    return buildAlpineJournal({
      seed: input.journalSeed,
      tenantId: input.tenantId,
      registrationId: input.registrationId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      createdAtIso: input.recordedAtIso,
      metadata: Object.freeze({ workspaceFinancePlugin: "alpine", kind: "prepayment" }),
    });
  }
}

function deterministicUuid(seed: string): string {
  const hash = createHash("sha256").update(seed, "utf8").digest();
  const buf = Buffer.alloc(16);
  hash.copy(buf, 0, 0, 16);
  buf[6] = (buf[6]! & 0x0f) | 0x40;
  buf[8] = (buf[8]! & 0x3f) | 0x80;
  const hex = buf.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function buildAlpineJournal(input: {
  readonly seed: string;
  readonly tenantId: string;
  readonly registrationId: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly createdAtIso: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}): FinanceLedgerCapturePlan {
  const amount = input.amountMinor.trim();
  if (!/^\d+$/.test(amount) || BigInt(amount) <= 0n) {
    throw new Error("ALPINE_LEDGER_AMOUNT_INVALID");
  }
  const journalId = deterministicUuid(`alpine:journal:${input.seed}`);
  const debitLineId = deterministicUuid(`alpine:journal:${input.seed}:debit`);
  const creditLineId = deterministicUuid(`alpine:journal:${input.seed}:credit`);
  const creditAccount = alpineBookingWalletId(input.registrationId);
  const lines: readonly FinanceLedgerJournalLine[] = Object.freeze([
    Object.freeze({
      id: debitLineId,
      journalId,
      tenantId: input.tenantId,
      account: ALPINE_LEDGER_ACCOUNTS.OPERATOR_CASH_CLEARING,
      side: "debit" as const,
      amount_minor: amount,
      currency: input.currency,
      correlationId: `${input.seed}:debit`,
      idempotencyKey: `${input.seed}:debit`,
      createdAt: input.createdAtIso,
      metadata: input.metadata,
    }),
    Object.freeze({
      id: creditLineId,
      journalId,
      tenantId: input.tenantId,
      account: creditAccount,
      side: "credit" as const,
      amount_minor: amount,
      currency: input.currency,
      correlationId: `${input.seed}:credit`,
      idempotencyKey: `${input.seed}:credit`,
      createdAt: input.createdAtIso,
      metadata: input.metadata,
    }),
  ]);
  return { journalId, domainEventId: `alpine:${input.seed}:ledger-capture`, lines };
}
