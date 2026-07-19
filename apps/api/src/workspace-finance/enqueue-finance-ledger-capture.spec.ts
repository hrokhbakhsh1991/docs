/**
 * Fail-closed enqueue — empty lines must not no-op as success.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { enqueueFinanceLedgerCaptureOutbox } from "./enqueue-finance-ledger-capture";

describe("enqueueFinanceLedgerCaptureOutbox fail-closed", () => {
  it("throws FINANCE_LEDGER_CAPTURE_EMPTY when lines are empty", async () => {
    await assert.rejects(
      () =>
        enqueueFinanceLedgerCaptureOutbox({
          outboxWriter: {
            async addEvent() {
              assert.fail("must not enqueue empty capture");
              return true;
            },
          },
          tenantId: "00000000-0000-4000-8000-000000000001",
          registrationId: "00000000-0000-4000-8000-000000000002",
          capture: {
            journalId: "j-empty",
            domainEventId: "payment:x:ledger-capture-anchor",
            lines: [],
          },
        }),
      /FINANCE_LEDGER_CAPTURE_EMPTY/
    );
  });
});
