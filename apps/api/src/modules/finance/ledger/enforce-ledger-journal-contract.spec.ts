import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadRequestException } from "@nestjs/common";
import {
  bookingLedgerAccountId,
  LEDGER_ACCOUNTS,
} from "@repo/shared-contracts";

import {
  enforceLedgerJournalContract,
  isLedgerContractValidationFailure,
  LEDGER_CONTRACT_VALIDATION_FAILED,
} from "./enforce-ledger-journal-contract";
import { postDoubleEntryJournal } from "./post-double-entry-journal";

const TENANT_ID = "bbbbbbbb-bbbb-4bbb-8222-bbbbbbbbbbbb";
const REGISTRATION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

describe("enforceLedgerJournalContract", () => {
  it("allows balanced postDoubleEntryJournal lines", () => {
    const { lines } = postDoubleEntryJournal({
      tenantId: TENANT_ID,
      debitAccount: LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING,
      creditAccount: bookingLedgerAccountId(REGISTRATION_ID),
      amount_minor: "1000",
      currency: "IRR",
      correlationId: "test:capture",
      idempotencyKey: "test:capture-key",
    });
    assert.doesNotThrow(() =>
      enforceLedgerJournalContract(lines, "test:balanced"),
    );
  });

  it("throws LEDGER_CONTRACT_VALIDATION_FAILED on imbalanced amounts", () => {
    const { lines } = postDoubleEntryJournal({
      tenantId: TENANT_ID,
      debitAccount: LEDGER_ACCOUNTS.REGISTRATION_LEADER_PAYMENT_CLEARING,
      creditAccount: bookingLedgerAccountId(REGISTRATION_ID),
      amount_minor: "1000",
      currency: "IRR",
      correlationId: "test:imbalanced",
      idempotencyKey: "test:imbalanced-key",
    });
    const imbalanced = [...lines];
    imbalanced[1] = { ...imbalanced[1]!, amount_minor: "1" };

    try {
      enforceLedgerJournalContract(imbalanced, "test:imbalanced");
      assert.fail("expected BadRequestException");
    } catch (error: unknown) {
      assert.ok(isLedgerContractValidationFailure(error));
      const body = (error as BadRequestException).getResponse() as {
        error?: { code?: string; message?: string };
      };
      assert.equal(body.error?.code, LEDGER_CONTRACT_VALIDATION_FAILED);
      assert.match(body.error?.message ?? "", /test:imbalanced/);
    }
  });
});
