import type { LedgerJournalLine } from "./ledger-journal-line";

export type PostDoubleEntryJournalResult = {
  journalId: string;
  /** Exactly two lines: debit first, credit second; sums balance in minor units for the journal. */
  lines: [LedgerJournalLine, LedgerJournalLine];
};
