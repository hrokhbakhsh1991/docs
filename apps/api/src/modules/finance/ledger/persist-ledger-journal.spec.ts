import assert from "node:assert/strict";
import test from "node:test";
import type { EntityManager } from "typeorm";
import { persistLedgerJournal } from "./persist-ledger-journal";
import type { PostDoubleEntryJournalResult } from "./post-double-entry-journal";

test("persistLedgerJournal inserts batch header before journal lines", async () => {
  const calls: string[] = [];
  const manager = {
    query: async (sql: string) => {
      calls.push(sql.trim().slice(0, 60));
      if (sql.includes("RETURNING id")) {
        return [{ id: "line-1" }];
      }
      return [];
    }
  } as unknown as EntityManager;

  const lineBase = {
    tenantId: "11111111-1111-4111-8111-111111111111",
    journalId: "journal-abc",
    amount_minor: "1000",
    currency: "IRR",
    correlationId: "c1",
    createdAt: "2030-01-01T00:00:00.000Z"
  };
  const result: PostDoubleEntryJournalResult = {
    journalId: "journal-abc",
    lines: [
      {
        id: "line-debit",
        ...lineBase,
        account: "gl:clearing",
        side: "debit",
        idempotencyKey: "k1:debit"
      },
      {
        id: "line-credit",
        ...lineBase,
        account: "booking:reg-1",
        side: "credit",
        idempotencyKey: "k1:credit"
      }
    ]
  };

  await persistLedgerJournal(manager, result);

  assert.ok(calls[0]!.includes("ledger_journal_batches"));
  assert.ok(calls[1]!.includes("ledger_journal_lines"));
});
