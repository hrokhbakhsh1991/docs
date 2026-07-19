/**
 * Cross-workspace ledger policy adapters — domainEventId + journal/line determinism.
 * Business capture formula must remain payment:{paymentId}:ledger-capture-anchor.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DenaliFinanceLedgerPolicyAdapter } from "@app-tour/workspace-denali";
import { FinanceWs2LedgerPolicyAdapter } from "@app-tour/workspace-finance-ws2";
import { FinanceWs3LedgerPolicyAdapter } from "@app-tour/workspace-finance-ws3";
import { FinanceWs4LedgerPolicyAdapter } from "@app-tour/workspace-finance-ws4";
import { FinanceWs5LedgerPolicyAdapter } from "@app-tour/workspace-finance-ws5";
import { FinanceWs6LedgerPolicyAdapter } from "@app-tour/workspace-finance-ws6";
import type { FinanceLedgerPolicyPort } from "@app-tour/finance-http-contracts";

import { assertStableCaptureIdentities } from "./enqueue-finance-ledger-capture";
import { paymentLedgerCaptureDomainEventId } from "./paid-without-ledger-detection";

const paymentId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const registrationId = "11111111-2222-4333-8444-555555555555";
const tenantId = "99999999-aaaa-4bbb-8ccc-dddddddddddd";

const adapters: Array<{ name: string; create: () => FinanceLedgerPolicyPort }> = [
  { name: "denali", create: () => new DenaliFinanceLedgerPolicyAdapter() },
  { name: "ws2", create: () => new FinanceWs2LedgerPolicyAdapter() },
  { name: "ws3", create: () => new FinanceWs3LedgerPolicyAdapter() },
  { name: "ws4", create: () => new FinanceWs4LedgerPolicyAdapter() },
  { name: "ws5", create: () => new FinanceWs5LedgerPolicyAdapter() },
  { name: "ws6", create: () => new FinanceWs6LedgerPolicyAdapter() },
];

describe("adapter identity stability (all workspace ledger policies)", () => {
  for (const entry of adapters) {
    it(`${entry.name}: payment capture ids stable across rebuild / replay`, () => {
      const policy = entry.create();
      const input = {
        tenantId,
        paymentId,
        registrationId,
        amountMinor: "999",
        currency: "USD",
        capturedAtIso: "2026-07-19T12:00:00.000Z",
      };
      const first = policy.buildPaymentCaptureJournal(input);
      const second = policy.buildPaymentCaptureJournal(input);
      assert.equal(first.domainEventId, paymentLedgerCaptureDomainEventId(paymentId));
      assert.equal(first.domainEventId, second.domainEventId);
      assert.equal(first.journalId, second.journalId);
      assert.equal(first.lines.length, 2);
      assert.equal(first.lines[0]!.id, second.lines[0]!.id);
      assert.equal(first.lines[1]!.id, second.lines[1]!.id);
      assertStableCaptureIdentities(first);
    });
  }

  it("assertStableCaptureIdentities rejects blank domainEventId", () => {
    assert.throws(
      () =>
        assertStableCaptureIdentities({
          journalId: "j",
          domainEventId: "  ",
          lines: [
            {
              id: "d",
              journalId: "j",
              tenantId,
              account: "a",
              side: "debit",
              amount_minor: "1",
              currency: "USD",
              correlationId: "c",
              idempotencyKey: "k",
              createdAt: "2026-07-19T00:00:00.000Z",
            },
          ],
        }),
      /FINANCE_LEDGER_IDENTITY_UNSTABLE/
    );
  });
});
