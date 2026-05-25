import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertLedgerJournalDoubleEntry,
  bookingLedgerAccountId,
  REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
} from "@repo/shared-contracts";
import type { LedgerJournalLineEntity } from "./entities/ledger-journal-line.entity";
import {
  toLedgerEntry,
  toLedgerEntryFromEntity,
  toLedgerJournalContractStrict,
  validateLedgerEntry,
} from "./ledger.adapter";
import type { LedgerJournalLine } from "./ledger-journal-line";
import { postDoubleEntryJournal } from "./post-double-entry-journal";

const JOURNAL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_ID = "bbbbbbbb-bbbb-4bbb-8222-bbbbbbbbbbbb";
const LINE_DEBIT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const LINE_CREDIT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const REGISTRATION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function balancedDomainLines(): [LedgerJournalLine, LedgerJournalLine] {
  const { journalId, lines } = postDoubleEntryJournal({
    tenantId: TENANT_ID,
    debitAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
    creditAccount: bookingLedgerAccountId(REGISTRATION_ID),
    amount_minor: "250000",
    currency: "IRR",
    correlationId: "capture",
    idempotencyKey: "capture-key",
    stableJournalAndLineIds: {
      journalId: JOURNAL_ID,
      debitLineId: LINE_DEBIT_ID,
      creditLineId: LINE_CREDIT_ID,
    },
    journalLinesCreatedAtIso: "2026-01-15T10:00:00.000Z",
  });
  assert.equal(journalId, JOURNAL_ID);
  return lines;
}

describe("ledger.adapter", () => {
  it("toLedgerEntry maps account to accountId and amount_minor to amountMinor", () => {
    const [debit] = balancedDomainLines();
    const entry = toLedgerEntry(debit);

    assert.equal(entry.accountId, REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT);
    assert.equal(entry.amountMinor, "250000");
    assert.equal(entry.currency, "IRR");
    assert.equal(entry.side, "debit");
    assert.equal(entry.journalId, JOURNAL_ID);
    assert.equal(entry.tenantId, TENANT_ID);
  });

  it("toLedgerEntryFromEntity maps TypeORM row to contract shape", () => {
    const [debit] = balancedDomainLines();
    const row = {
      id: debit.id,
      journalId: debit.journalId,
      tenantId: debit.tenantId,
      account: debit.account,
      side: debit.side,
      amountMinor: debit.amount_minor,
      currency: debit.currency,
      idempotencyKey: debit.idempotencyKey,
      correlationId: debit.correlationId,
      createdAt: new Date(debit.createdAt),
      reversesLineId: null,
      metadata: null,
    } as LedgerJournalLineEntity;

    const fromEntity = toLedgerEntryFromEntity(row);
    const fromDomain = toLedgerEntry(debit);

    assert.equal(fromEntity.accountId, fromDomain.accountId);
    assert.equal(fromEntity.amountMinor, fromDomain.amountMinor);
    assert.equal(fromEntity.currency, fromDomain.currency);
  });

  it("validateLedgerEntry accepts a mapped balanced line", () => {
    const [debit] = balancedDomainLines();
    const validated = validateLedgerEntry(toLedgerEntry(debit));
    assert.equal(validated.id, LINE_DEBIT_ID);
    assert.equal(validated.amountMinor, "250000");
  });

  it("toLedgerJournalContractStrict maps balanced journal lines", () => {
    const lines = balancedDomainLines();
    const journal = toLedgerJournalContractStrict([...lines]);
    assert.equal(journal.journalId, JOURNAL_ID);
    assert.equal(journal.tenantId, TENANT_ID);
    assert.equal(journal.lines.length, 2);
    assert.equal(journal.lines[0]?.side, "debit");
    assert.equal(journal.lines[1]?.side, "credit");
  });

  it("assertLedgerJournalDoubleEntry throws on double-entry violation", () => {
    const [debit, credit] = balancedDomainLines();
    const entries = [toLedgerEntry(debit), toLedgerEntry({ ...credit, amount_minor: "1" })];

    assert.throws(
      () =>
        assertLedgerJournalDoubleEntry(entries, {
          journalId: JOURNAL_ID,
          tenantId: TENANT_ID,
        }),
      /LEDGER_DOUBLE_ENTRY_INVALID/,
    );
  });

});
