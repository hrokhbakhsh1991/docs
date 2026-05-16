import type { LedgerJournalLine } from "./ledger-journal-line";

type TwoLineJournal = {
  journalId: string;
  lines: [LedgerJournalLine, LedgerJournalLine];
};

/**
 * Makes in-memory journal lines non-mutable (shallow freeze of line + metadata object).
 * Persisted rows must additionally use INSERT-only repositories and DB forbid-UPDATE triggers.
 */
export function freezeLedgerJournalLine(line: LedgerJournalLine): LedgerJournalLine {
  if (line.metadata !== undefined) {
    Object.freeze(line.metadata);
  }
  return Object.freeze(line);
}

export function freezePostDoubleEntryJournalResult(result: TwoLineJournal): TwoLineJournal {
  const a = freezeLedgerJournalLine(result.lines[0]!);
  const b = freezeLedgerJournalLine(result.lines[1]!);
  return Object.freeze({
    journalId: result.journalId,
    lines: Object.freeze([a, b]) as [LedgerJournalLine, LedgerJournalLine]
  });
}
