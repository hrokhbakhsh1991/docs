import { randomUUID } from "node:crypto";
import { assertLedgerJournalDoubleEntry } from "@repo/shared-contracts";
import type { EntityManager } from "typeorm";
import { freezePostDoubleEntryJournalResult } from "./freeze-ledger-journal";
import { persistLedgerJournal } from "./persist-ledger-journal";
import type { LedgerJournalLine, LedgerPostingSide } from "./ledger-journal-line";

export type PostDoubleEntryJournalInput = {
  tenantId: string;
  debitAccount: string;
  creditAccount: string;
  /** Positive integer string in minor units. */
  amount_minor: string;
  currency: string;
  correlationId: string;
  /** Base idempotency key; line keys are derived with `:debit` / `:credit` suffixes. */
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  /**
   * Deterministic ids for **synthetic replay** of an economic posting (e.g. payment capture anchor
   * before emitting a refund reversal that {@link LedgerJournalLine.reversesLineId} links to).
   */
  stableJournalAndLineIds?: {
    journalId: string;
    debitLineId: string;
    creditLineId: string;
  };
  /** Overrides `createdAt` on both lines (audit alignment with an external clock such as `paid_at`). */
  journalLinesCreatedAtIso?: string;
};

export type PostDoubleEntryJournalResult = {
  journalId: string;
  /** Exactly two lines: debit first, credit second; sums balance in minor units for the journal. */
  lines: [LedgerJournalLine, LedgerJournalLine];
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
  reversesLineId?: string;
}): LedgerJournalLine {
  const line: LedgerJournalLine = {
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
    metadata: input.metadata
  };
  if (input.reversesLineId !== undefined) {
    line.reversesLineId = input.reversesLineId;
  }
  return line;
}

function assertBalancedInMemoryJournal(
  journalId: string,
  tenantId: string,
  lines: readonly [LedgerJournalLine, LedgerJournalLine],
): void {
  assertLedgerJournalDoubleEntry(
    lines.map((line) => ({
      journalId: line.journalId,
      tenantId: line.tenantId,
      side: line.side,
      amountMinor: line.amount_minor,
      currency: line.currency,
    })),
    { journalId, tenantId },
  );
}

/**
 * Materializes one **balanced** double-entry journal in memory (no DB write).
 * **Invariant:** exactly one debit line and one credit line; same `amount_minor`; different accounts.
 * Returned lines and result object are **frozen** — treat as immutable facts until persisted with INSERT only.
 */
export function postDoubleEntryJournal(input: PostDoubleEntryJournalInput): PostDoubleEntryJournalResult {
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
  const meta = input.metadata;
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
    metadata: meta,
    lineId: stable?.debitLineId,
    ...(createdAtIso !== undefined && createdAtIso !== ""
      ? { createdAtIso: createdAtIso }
      : {})
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
    metadata: meta,
    lineId: stable?.creditLineId,
    ...(createdAtIso !== undefined && createdAtIso !== ""
      ? { createdAtIso: createdAtIso }
      : {})
  });

  const lines = [debitLine, creditLine] as const;
  assertBalancedInMemoryJournal(journalId, tenantId, lines);
  return freezePostDoubleEntryJournalResult({ journalId, lines: [...lines] });
}

/** Materialize + persist a balanced journal on `manager` (SQL durability anchor). */
export async function postAndPersistDoubleEntryJournal(
  manager: EntityManager,
  input: PostDoubleEntryJournalInput
): Promise<PostDoubleEntryJournalResult & { anyLineInserted: boolean }> {
  const result = postDoubleEntryJournal(input);
  const { anyLineInserted } = await persistLedgerJournal(manager, result);
  return { ...result, anyLineInserted };
}

export type PostDoubleEntryReversalJournalInput = {
  tenantId: string;
  /** The two lines from {@link postDoubleEntryJournal} in canonical order `[debit, credit]`. */
  originalLines: readonly [LedgerJournalLine, LedgerJournalLine];
  correlationId: string;
  /** Base idempotency key; reversal line keys use `:reversal:debit` / `:reversal:credit` suffixes. */
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
};

/**
 * Append-only **reversal** journal: debits what was credited and credits what was debited, with each
 * new line’s {@link LedgerJournalLine.reversesLineId} pointing at the **original** line it economically negates.
 */
export function postDoubleEntryReversalJournal(
  input: PostDoubleEntryReversalJournalInput
): PostDoubleEntryJournalResult {
  const [origDebit, origCredit] = input.originalLines;
  if (origDebit.side !== "debit" || origCredit.side !== "credit") {
    throw new Error("LEDGER_REVERSAL_ORDER: originalLines must be [debit, credit]");
  }
  if (origDebit.journalId !== origCredit.journalId) {
    throw new Error("LEDGER_REVERSAL_JOURNAL: both lines must share the same journalId");
  }
  const tenantId = trimNonEmpty("TENANT_ID", input.tenantId);
  if (origDebit.tenantId !== tenantId || origCredit.tenantId !== tenantId) {
    throw new Error("LEDGER_REVERSAL_TENANT: tenantId must match original lines");
  }
  const amountStr = assertPositiveMinorAmount(origDebit.amount_minor).toString();
  if (origCredit.amount_minor.trim() !== amountStr) {
    throw new Error("LEDGER_REVERSAL_AMOUNT: original debit/credit amounts must match");
  }
  if (origDebit.currency !== origCredit.currency) {
    throw new Error("LEDGER_REVERSAL_CURRENCY: original lines must share currency");
  }

  const journalId = randomUUID();
  const meta = input.metadata;
  const correlationId = trimNonEmpty("CORRELATION_ID", input.correlationId);
  const baseKey = trimNonEmpty("IDEMPOTENCY_KEY", input.idempotencyKey);
  const currency = origDebit.currency;

  const debitLine = materializeLine({
    journalId,
    tenantId,
    account: origCredit.account,
    side: "debit",
    amount_minor: amountStr,
    currency,
    correlationId: `${correlationId}:reversal:debit`,
    idempotencyKey: `${baseKey}:reversal:debit`,
    metadata: meta,
    reversesLineId: origCredit.id
  });

  const creditLine = materializeLine({
    journalId,
    tenantId,
    account: origDebit.account,
    side: "credit",
    amount_minor: amountStr,
    currency,
    correlationId: `${correlationId}:reversal:credit`,
    idempotencyKey: `${baseKey}:reversal:credit`,
    metadata: meta,
    reversesLineId: origDebit.id
  });

  const lines = [debitLine, creditLine] as const;
  assertBalancedInMemoryJournal(journalId, tenantId, lines);
  return freezePostDoubleEntryJournalResult({ journalId, lines: [...lines] });
}

/** Materialize + persist a reversal journal on `manager`. */
export async function postAndPersistDoubleEntryReversalJournal(
  manager: EntityManager,
  input: PostDoubleEntryReversalJournalInput
): Promise<PostDoubleEntryJournalResult & { anyLineInserted: boolean }> {
  const result = postDoubleEntryReversalJournal(input);
  const { anyLineInserted } = await persistLedgerJournal(manager, result);
  return { ...result, anyLineInserted };
}
