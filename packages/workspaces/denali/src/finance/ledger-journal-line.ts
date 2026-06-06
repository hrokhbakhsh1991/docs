/**
 * One immutable ledger line (future `ledger_journal_lines` row).
 * Corrections append new lines linked via {@link LedgerJournalLine.reversesLineId}.
 */
export type LedgerPostingSide = "debit" | "credit";

export type LedgerJournalLine = {
  id: string;
  journalId: string;
  tenantId: string;
  account: string;
  side: LedgerPostingSide;
  amount_minor: string;
  currency: string;
  correlationId: string;
  idempotencyKey: string;
  reversesLineId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};
