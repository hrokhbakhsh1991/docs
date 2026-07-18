/**
 * Phase 1.1 — finance dependency registry (Denali-only registration).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  listRegisteredFinanceWorkspaceTypes,
  resolveBootFinanceWorkspaceType,
  resolveFinanceLedgerPolicy,
  resolveFinanceReceiptDefaults,
} from "./finance-dependency-registry.ts";
import { DenaliFinanceLedgerPolicyAdapter } from "./infrastructure/denali-finance-ledger-policy.adapter.ts";
import { DenaliFinanceReceiptDefaultsAdapter } from "./infrastructure/denali-finance-receipt-defaults.adapter.ts";

const DENALI = "denali";

describe("finance-dependency-registry", { concurrency: false }, () => {
  it("FIN-REG-01 denali resolves DenaliFinanceLedgerPolicyAdapter", () => {
    const policy = resolveFinanceLedgerPolicy(DENALI);
    assert.ok(policy instanceof DenaliFinanceLedgerPolicyAdapter);
  });

  it("FIN-REG-02 denali receipt defaults match prior offline literals (IRR / 2500000)", () => {
    const defaults = resolveFinanceReceiptDefaults(DENALI);
    assert.ok(defaults instanceof DenaliFinanceReceiptDefaultsAdapter);
    assert.deepEqual(defaults.offlineReceiptPaymentDefaults(), {
      amountMinor: "2500000",
      currency: "IRR",
    });
  });

  it("FIN-REG-03 boot finance workspace type remains denali", () => {
    assert.equal(resolveBootFinanceWorkspaceType(), DENALI);
  });

  it("FIN-REG-04 unknown workspaceType fails clearly for ledger policy", () => {
    assert.throws(
      () => resolveFinanceLedgerPolicy("urban"),
      (error: unknown) =>
        error instanceof Error &&
        error.message.startsWith("FINANCE_LEDGER_POLICY_UNSUPPORTED:") &&
        error.message.includes("urban")
    );
  });

  it("FIN-REG-05 unknown workspaceType fails clearly for receipt defaults", () => {
    assert.throws(
      () => resolveFinanceReceiptDefaults("not-a-workspace"),
      (error: unknown) =>
        error instanceof Error &&
        error.message.startsWith("FINANCE_RECEIPT_DEFAULTS_UNSUPPORTED:")
    );
  });

  it("FIN-REG-06 empty workspaceType fails with FINANCE_WORKSPACE_TYPE_REQUIRED", () => {
    assert.throws(
      () => resolveFinanceLedgerPolicy("   "),
      (error: unknown) =>
        error instanceof Error && error.message.startsWith("FINANCE_WORKSPACE_TYPE_REQUIRED:")
    );
    assert.throws(
      () => resolveFinanceReceiptDefaults(""),
      (error: unknown) =>
        error instanceof Error && error.message.startsWith("FINANCE_WORKSPACE_TYPE_REQUIRED:")
    );
  });

  it("FIN-REG-07 denali ledger capture domainEventId formula unchanged", () => {
    const policy = resolveFinanceLedgerPolicy(DENALI);
    const paymentId = "11111111-1111-4111-8111-111111111111";
    const capture = policy.buildPaymentCaptureJournal({
      tenantId: "00000000-0000-4000-8000-000000000001",
      registrationId: "22222222-2222-4222-8222-222222222222",
      paymentId,
      amountMinor: "2500000",
      currency: "IRR",
      capturedAtIso: "2026-07-18T00:00:00.000Z",
    });
    assert.equal(capture.domainEventId, `payment:${paymentId}:ledger-capture-anchor`);
  });

  it("FIN-REG-08 only denali is registered in Phase 1.1", () => {
    assert.deepEqual(listRegisteredFinanceWorkspaceTypes(), [DENALI]);
  });

  it("FIN-REG-09 finance-ws2 is not registered yet (fail-closed)", () => {
    assert.throws(
      () => resolveFinanceLedgerPolicy("finance-ws2"),
      (error: unknown) =>
        error instanceof Error && error.message.startsWith("FINANCE_LEDGER_POLICY_UNSUPPORTED:")
    );
  });
});
