import type { LedgerJournalLineEntity } from "../entities/ledger-journal-line.entity";
import { ledgerJournalLineEntityToDomain } from "./ledger-journal-line.mapper";
import { toLedgerEntry } from "../ledger.adapter";
import type { LedgerEntry } from "@repo/shared-contracts";

/** Maps a persisted {@link LedgerJournalLineEntity} via the domain mapper. */
export function toLedgerEntryFromEntity(row: LedgerJournalLineEntity): LedgerEntry {
  return toLedgerEntry(ledgerJournalLineEntityToDomain(row));
}
