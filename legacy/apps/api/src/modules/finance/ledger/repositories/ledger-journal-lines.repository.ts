import type { EntityManager } from "typeorm";
import { LedgerJournalLineEntity } from "../entities/ledger-journal-line.entity";
import { ledgerJournalLineEntityToDomain } from "./ledger-journal-line.mapper";
import type { LedgerJournalLine } from "../ledger-journal-line";

export async function findDebitCreditPairForJournal(
  manager: EntityManager,
  tenantId: string,
  journalId: string
): Promise<[LedgerJournalLine, LedgerJournalLine]> {
  const rows = await manager.find(LedgerJournalLineEntity, {
    where: { tenantId, journalId },
    order: { side: "ASC", id: "ASC" },
  });
  const debit = rows.find((r) => r.side === "debit");
  const credit = rows.find((r) => r.side === "credit");
  if (!debit || !credit) {
    throw new Error(
      `PAYMENT_REFUND_LEDGER_ANCHOR_MISSING: journal ${journalId} has no debit/credit pair`
    );
  }
  return [ledgerJournalLineEntityToDomain(debit), ledgerJournalLineEntityToDomain(credit)];
}
