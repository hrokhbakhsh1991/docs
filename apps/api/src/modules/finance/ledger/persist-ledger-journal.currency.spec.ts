import assert from "node:assert/strict";
import test from "node:test";
import type { EntityManager } from "typeorm";
import { persistLedgerJournal } from "./persist-ledger-journal";
import type { PostDoubleEntryJournalResult } from "./post-double-entry-journal";

test("persistLedgerJournal upserts separate account_balances rows per currency", async () => {
  const upsertParams: Array<{ account: string; currency: string; delta: string }> = [];
  const manager = {
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes("account_balances") && sql.includes("ON CONFLICT")) {
        upsertParams.push({
          account: params![1] as string,
          currency: params![3] as string,
          delta: params![2] as string
        });
        return [];
      }
      if (sql.includes("RETURNING id")) {
        return [{ id: `line-${upsertParams.length}` }];
      }
      return [];
    }
  } as unknown as EntityManager;

  const base = {
    tenantId: "11111111-1111-4111-8111-111111111111",
    journalId: "j-1",
    amount_minor: "100",
    correlationId: "c",
    createdAt: "2030-01-01T00:00:00.000Z"
  };

  await persistLedgerJournal(manager, {
    journalId: "j-usd",
    lines: [
      {
        id: "l1",
        ...base,
        journalId: "j-usd",
        account: "booking:reg-1",
        side: "credit",
        currency: "USD",
        idempotencyKey: "k1"
      },
      {
        id: "l2",
        ...base,
        journalId: "j-usd",
        account: "gl:clearing",
        side: "debit",
        currency: "USD",
        idempotencyKey: "k2"
      }
    ]
  } as PostDoubleEntryJournalResult);

  await persistLedgerJournal(manager, {
    journalId: "j-irr",
    lines: [
      {
        id: "l3",
        ...base,
        journalId: "j-irr",
        account: "booking:reg-1",
        side: "credit",
        currency: "IRR",
        idempotencyKey: "k3"
      },
      {
        id: "l4",
        ...base,
        journalId: "j-irr",
        account: "gl:clearing",
        side: "debit",
        currency: "IRR",
        idempotencyKey: "k4"
      }
    ]
  } as PostDoubleEntryJournalResult);

  const bookingUpserts = upsertParams.filter((p) => p.account === "booking:reg-1");
  assert.equal(bookingUpserts.length, 2);
  assert.equal(bookingUpserts[0]!.currency, "USD");
  assert.equal(bookingUpserts[1]!.currency, "IRR");
});
