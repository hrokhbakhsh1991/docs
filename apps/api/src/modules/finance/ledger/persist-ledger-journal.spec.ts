import assert from "node:assert/strict";
import test from "node:test";
import type { EntityManager } from "typeorm";
import {
  bookingLedgerAccountId,
  REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
} from "@repo/shared-contracts";
import { isLedgerContractValidationFailure } from "./enforce-ledger-journal-contract";
import { persistLedgerJournal } from "./persist-ledger-journal";
import { postDoubleEntryJournal } from "./post-double-entry-journal";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const REGISTRATION_ID = "22222222-2222-4222-8222-222222222222";

test("persistLedgerJournal inserts batch header before journal lines", async () => {
  const calls: string[] = [];
  const manager = {
    query: async (sql: string) => {
      calls.push(sql.trim().slice(0, 60));
      if (sql.includes("RETURNING id")) {
        return [{ id: "line-1" }];
      }
      return [];
    },
  } as unknown as EntityManager;

  const result = postDoubleEntryJournal({
    tenantId: TENANT_ID,
    debitAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
    creditAccount: bookingLedgerAccountId(REGISTRATION_ID),
    amount_minor: "1000",
    currency: "IRR",
    correlationId: "persist-spec",
    idempotencyKey: "persist-spec-key",
    stableJournalAndLineIds: {
      journalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      debitLineId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      creditLineId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    },
    journalLinesCreatedAtIso: "2030-01-01T00:00:00.000Z",
  });

  await persistLedgerJournal(manager, result);

  assert.ok(calls[0]!.includes("ledger_journal_batches"));
  assert.ok(calls[1]!.includes("ledger_journal_lines"));
});

test("persistLedgerJournal throws LEDGER_CONTRACT_VALIDATION_FAILED before SQL when imbalanced", async () => {
  const manager = {
    query: async () => {
      assert.fail("must not run SQL when contract validation fails");
    },
  } as unknown as EntityManager;

  const result = postDoubleEntryJournal({
    tenantId: TENANT_ID,
    debitAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
    creditAccount: bookingLedgerAccountId(REGISTRATION_ID),
    amount_minor: "1000",
    currency: "IRR",
    correlationId: "persist-fail",
    idempotencyKey: "persist-fail-key",
  });
  const lines = [...result.lines];
  lines[1] = { ...lines[1]!, amount_minor: "1" };

  await assert.rejects(
    () =>
      persistLedgerJournal(manager, {
        journalId: result.journalId,
        lines: lines as typeof result.lines,
      }),
    (err: unknown) => {
      assert.ok(isLedgerContractValidationFailure(err));
      return true;
    },
  );
});
