import assert from "node:assert/strict";
import test from "node:test";
import type { EntityManager } from "typeorm";
import {
  bookingLedgerAccountId,
  REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
} from "@repo/shared-contracts";
import { persistLedgerJournal } from "./persist-ledger-journal";
import { postDoubleEntryJournal } from "./post-double-entry-journal";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const REGISTRATION_ID = "22222222-2222-4222-8222-222222222222";

test("persistLedgerJournal upserts separate account_balances rows per currency", async () => {
  const upsertParams: Array<{ account: string; currency: string; delta: string }> = [];
  const manager = {
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes("account_balances") && sql.includes("ON CONFLICT")) {
        upsertParams.push({
          account: params![1] as string,
          currency: params![3] as string,
          delta: params![2] as string,
        });
        return [];
      }
      if (sql.includes("RETURNING id")) {
        return [{ id: `line-${upsertParams.length}` }];
      }
      return [];
    },
  } as unknown as EntityManager;

  const usdJournal = postDoubleEntryJournal({
    tenantId: TENANT_ID,
    debitAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
    creditAccount: bookingLedgerAccountId(REGISTRATION_ID),
    amount_minor: "100",
    currency: "USD",
    correlationId: "c-usd",
    idempotencyKey: "k-usd",
    stableJournalAndLineIds: {
      journalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      debitLineId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      creditLineId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    },
    journalLinesCreatedAtIso: "2030-01-01T00:00:00.000Z",
  });

  const irrJournal = postDoubleEntryJournal({
    tenantId: TENANT_ID,
    debitAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
    creditAccount: bookingLedgerAccountId(REGISTRATION_ID),
    amount_minor: "100",
    currency: "IRR",
    correlationId: "c-irr",
    idempotencyKey: "k-irr",
    stableJournalAndLineIds: {
      journalId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      debitLineId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      creditLineId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    },
    journalLinesCreatedAtIso: "2030-01-01T00:00:00.000Z",
  });

  await persistLedgerJournal(manager, usdJournal);
  await persistLedgerJournal(manager, irrJournal);

  const bookingAccount = bookingLedgerAccountId(REGISTRATION_ID);
  const bookingUpserts = upsertParams.filter((p) => p.account === bookingAccount);
  assert.equal(bookingUpserts.length, 2);
  assert.equal(bookingUpserts[0]!.currency, "USD");
  assert.equal(bookingUpserts[1]!.currency, "IRR");
});
