import { randomUUID } from "node:crypto";

import type { LedgerJournalLine, LedgerPostingSide } from "./ledger-journal-line";

export type PostDoubleEntryJournalInput = {
  tenantId: string;
  debitAccount: string;
  creditAccount: string;
  amount_minor: string;
  currency: string;
  correlationId: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  stableJournalAndLineIds?: {
    journalId: string;
    debitLineId: string;
    creditLineId: string;
  };
  journalLinesCreatedAtIso?: string;
};

export type PostDoubleEntryJournalResult = {
  journalId: string;
  lines: readonly LedgerJournalLine[];
};

function trimNonEmpty(name: string, value: string): string {
  const t = value.trim();
  if (t.length === 0) {
    throw new Error(`LEDGER_${name}_REQUIRED: postDoubleEntryJournal requires a non-empty ${name}`);
  }
  return t;
}

function assertPositiveMinorAmount(amount_minor: string): bigint {
  const t = amount_minor.trim();
  if (!/^\d+$/.test(t)) {
    throw new Error(
      "LEDGER_AMOUNT_INVALID: postDoubleEntryJournal requires amount_minor as a non-negative integer string"
    );
  }
  const n = BigInt(t);
  if (n <= 0n) {
    throw new Error("LEDGER_AMOUNT_POSITIVE: postDoubleEntryJournal requires amount_minor > 0");
  }
  return n;
}

function materializeLine(input: {
  journalId: string;
  tenantId: string;
  account: string;
  side: LedgerPostingSide;
  amount_minor: string;
  currency: string;
  correlationId: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  lineId?: string;
  createdAtIso?: string;
}): LedgerJournalLine {
  return {
    id: input.lineId ?? randomUUID(),
    journalId: input.journalId,
    tenantId: input.tenantId,
    account: input.account,
    side: input.side,
    amount_minor: input.amount_minor,
    currency: input.currency,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
    createdAt: input.createdAtIso ?? new Date().toISOString(),
    metadata: input.metadata,
  };
}

function assertBalancedInMemoryJournal(
  journalId: string,
  tenantId: string,
  lines: readonly [LedgerJournalLine, LedgerJournalLine]
): void {
  const [debit, credit] = lines;
  if (debit.side !== "debit" || credit.side !== "credit") {
    throw new Error("LEDGER_DOUBLE_ENTRY_INVALID: journal requires one debit and one credit line");
  }
  if (debit.journalId !== journalId || credit.journalId !== journalId) {
    throw new Error("LEDGER_DOUBLE_ENTRY_INVALID: lines must share journalId");
  }
  if (debit.tenantId !== tenantId || credit.tenantId !== tenantId) {
    throw new Error("LEDGER_DOUBLE_ENTRY_INVALID: lines must share tenantId");
  }
  if (debit.amount_minor !== credit.amount_minor) {
    throw new Error("LEDGER_DOUBLE_ENTRY_INVALID: debit and credit amounts must match");
  }
  if (debit.currency !== credit.currency) {
    throw new Error("LEDGER_DOUBLE_ENTRY_INVALID: debit and credit currency must match");
  }
  if (debit.account === credit.account) {
    throw new Error("LEDGER_DOUBLE_ENTRY_INVALID: debit and credit accounts must differ");
  }
}

export function postDoubleEntryJournal(
  input: PostDoubleEntryJournalInput
): PostDoubleEntryJournalResult {
  const tenantId = trimNonEmpty("TENANT_ID", input.tenantId);
  const debitAccount = trimNonEmpty("DEBIT_ACCOUNT", input.debitAccount);
  const creditAccount = trimNonEmpty("CREDIT_ACCOUNT", input.creditAccount);
  if (debitAccount === creditAccount) {
    throw new Error(
      "LEDGER_ACCOUNTS_DISTINCT: postDoubleEntryJournal requires debitAccount !== creditAccount"
    );
  }
  const currency = trimNonEmpty("CURRENCY", input.currency);
  const correlationId = trimNonEmpty("CORRELATION_ID", input.correlationId);
  const baseKey = trimNonEmpty("IDEMPOTENCY_KEY", input.idempotencyKey);
  const amountStr = assertPositiveMinorAmount(input.amount_minor).toString();

  const stable = input.stableJournalAndLineIds;
  const journalId = stable?.journalId ?? randomUUID();
  const createdAtIso = input.journalLinesCreatedAtIso?.trim();

  const debitLine = materializeLine({
    journalId,
    tenantId,
    account: debitAccount,
    side: "debit",
    amount_minor: amountStr,
    currency,
    correlationId: `${correlationId}:debit`,
    idempotencyKey: `${baseKey}:debit`,
    metadata: input.metadata,
    lineId: stable?.debitLineId,
    ...(createdAtIso ? { createdAtIso } : {}),
  });

  const creditLine = materializeLine({
    journalId,
    tenantId,
    account: creditAccount,
    side: "credit",
    amount_minor: amountStr,
    currency,
    correlationId: `${correlationId}:credit`,
    idempotencyKey: `${baseKey}:credit`,
    metadata: input.metadata,
    lineId: stable?.creditLineId,
    ...(createdAtIso ? { createdAtIso } : {}),
  });

  const lines = [debitLine, creditLine] as const;
  assertBalancedInMemoryJournal(journalId, tenantId, lines);
  return { journalId, lines };
}
