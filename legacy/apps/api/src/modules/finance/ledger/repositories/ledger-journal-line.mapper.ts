import { LedgerJournalLineEntity } from "../entities/ledger-journal-line.entity";
import type { LedgerJournalLine } from "../ledger-journal-line";

export function ledgerJournalLineEntityToDomain(row: LedgerJournalLineEntity): LedgerJournalLine {
  const line: LedgerJournalLine = {
    id: row.id,
    journalId: row.journalId,
    tenantId: row.tenantId,
    account: row.account,
    side: row.side,
    amount_minor: row.amountMinor,
    currency: row.currency,
    correlationId: row.correlationId,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.reversesLineId) {
    line.reversesLineId = row.reversesLineId;
  }
  if (row.metadata) {
    line.metadata = row.metadata;
  }
  return line;
}
