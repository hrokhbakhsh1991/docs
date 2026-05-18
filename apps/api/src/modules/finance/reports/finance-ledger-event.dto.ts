import type { LedgerJournalLine } from "../ledger/ledger-journal-line";

/** Read-model row for `GET /finance/reports/ledger-events` (sourced from outbox). */
export type FinanceLedgerEventRow = {
  outboxEventId: string;
  eventType: string;
  journalId: string;
  registrationId: string | null;
  domainEventId: string | null;
  lineCount: number;
  createdAt: Date;
  lines: LedgerJournalLine[];
};
