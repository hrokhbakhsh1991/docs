/**
 * Phase 1.3 — finance dependency registry (Denali + finance-ws2 architecture fixture).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  listRegisteredFinanceWorkspaceTypes,
  resolveBootFinanceWorkspaceType,
  resolveFinanceBookingPayments,
  resolveFinanceLedgerPolicy,
  resolveFinanceReceiptDefaults,
  resolveFinanceWorkspaceDependencies,
} from "./finance-dependency-registry.ts";
import { BookingPaymentAdapter } from "./infrastructure/booking-payment.adapter.ts";
import { DenaliFinanceLedgerPolicyAdapter } from "@app-tour/workspace-denali";
import { DenaliFinanceReceiptDefaultsAdapter } from "@app-tour/workspace-denali";
import {
  FINANCE_WS2_LEDGER_ACCOUNTS,
  FINANCE_WS2_WORKSPACE_TYPE,
  financeWs2BookingWalletId,
} from "@app-tour/workspace-finance-ws2";
import { FinanceWs2LedgerPolicyAdapter } from "@app-tour/workspace-finance-ws2";
import { FinanceWs2ReceiptDefaultsAdapter } from "@app-tour/workspace-finance-ws2";
import type { FinanceService } from "./finance.service.ts";

const DENALI = "denali";
const WS2 = FINANCE_WS2_WORKSPACE_TYPE;

describe("finance-dependency-registry", { concurrency: false }, () => {
  it("FIN-REG-01 denali resolves DenaliFinanceLedgerPolicyAdapter", async () => {
    const policy = await resolveFinanceLedgerPolicy(DENALI);
    assert.ok(policy instanceof DenaliFinanceLedgerPolicyAdapter);
  });

  it("FIN-REG-02 denali receipt defaults match prior offline literals (IRR / 2500000)", async () => {
    const defaults = await resolveFinanceReceiptDefaults(DENALI);
    assert.ok(defaults instanceof DenaliFinanceReceiptDefaultsAdapter);
    assert.deepEqual(defaults.offlineReceiptPaymentDefaults(), {
      amountMinor: "2500000",
      currency: "IRR",
    });
  });

  it("FIN-REG-03 boot finance workspace type requires env; override honored", () => {
    const prev = process.env.FINANCE_BOOT_WORKSPACE_TYPE;
    delete process.env.FINANCE_BOOT_WORKSPACE_TYPE;
    try {
      assert.throws(
        () => resolveBootFinanceWorkspaceType(),
        (error: unknown) =>
          error instanceof Error && error.message === "FINANCE_BOOT_WORKSPACE_TYPE_REQUIRED"
      );
      process.env.FINANCE_BOOT_WORKSPACE_TYPE = WS2;
      assert.equal(resolveBootFinanceWorkspaceType(), WS2);
    } finally {
      if (prev === undefined) {
        delete process.env.FINANCE_BOOT_WORKSPACE_TYPE;
      } else {
        process.env.FINANCE_BOOT_WORKSPACE_TYPE = prev;
      }
    }
  });

  it("FIN-REG-04 unknown workspaceType fails clearly for ledger policy", async () => {
    await assert.rejects(
      () => resolveFinanceLedgerPolicy("urban"),
      (error: unknown) =>
        error instanceof Error &&
        error.message.startsWith("FINANCE_LEDGER_POLICY_UNSUPPORTED:") &&
        error.message.includes("urban")
    );
  });

  it("FIN-REG-05 unknown workspaceType fails clearly for receipt defaults", async () => {
    await assert.rejects(
      () => resolveFinanceReceiptDefaults("not-a-workspace"),
      (error: unknown) =>
        error instanceof Error && error.message.startsWith("FINANCE_RECEIPT_DEFAULTS_UNSUPPORTED:")
    );
  });

  it("FIN-REG-06 empty workspaceType fails with FINANCE_WORKSPACE_TYPE_REQUIRED", async () => {
    await assert.rejects(
      () => resolveFinanceLedgerPolicy("   "),
      (error: unknown) =>
        error instanceof Error && error.message.startsWith("FINANCE_WORKSPACE_TYPE_REQUIRED:")
    );
    await assert.rejects(
      () => resolveFinanceReceiptDefaults(""),
      (error: unknown) =>
        error instanceof Error && error.message.startsWith("FINANCE_WORKSPACE_TYPE_REQUIRED:")
    );
  });

  it("FIN-REG-07 denali ledger capture domainEventId formula unchanged", async () => {
    const policy = await resolveFinanceLedgerPolicy(DENALI);
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

  it("FIN-REG-08 finance-ws2 resolves WS2 adapters (not Denali)", async () => {
    const policy = await resolveFinanceLedgerPolicy(WS2);
    const defaults = await resolveFinanceReceiptDefaults(WS2);
    assert.ok(policy instanceof FinanceWs2LedgerPolicyAdapter);
    assert.ok(defaults instanceof FinanceWs2ReceiptDefaultsAdapter);
    assert.ok(!(policy instanceof DenaliFinanceLedgerPolicyAdapter));
    assert.ok(!(defaults instanceof DenaliFinanceReceiptDefaultsAdapter));
  });

  it("FIN-REG-09 finance-ws2 receipt defaults are USD / 10000 (not Denali IRR)", async () => {
    assert.deepEqual((await resolveFinanceReceiptDefaults(WS2)).offlineReceiptPaymentDefaults(), {
      amountMinor: "10000",
      currency: "USD",
    });
  });

  it("FIN-REG-10 finance-ws2 capture uses WS2 CoA — no Denali account leakage", async () => {
    const registrationId = "33333333-3333-4333-8333-333333333333";
    const paymentId = "44444444-4444-4444-8444-444444444444";
    const capture = (await resolveFinanceLedgerPolicy(WS2)).buildPaymentCaptureJournal({
      tenantId: "00000000-0000-4000-8000-000000000001",
      registrationId,
      paymentId,
      amountMinor: "10000",
      currency: "USD",
      capturedAtIso: "2026-07-18T00:00:00.000Z",
    });
    const accounts = capture.lines.map((line) => line.account);
    assert.deepEqual(
      accounts.sort(),
      [
        FINANCE_WS2_LEDGER_ACCOUNTS.OPERATOR_CASH_CLEARING,
        financeWs2BookingWalletId(registrationId),
      ].sort()
    );
    assert.ok(!accounts.some((a) => a.startsWith("gl:") || a.startsWith("booking:")));
    assert.equal(capture.domainEventId, `payment:${paymentId}:ledger-capture-anchor`);
  });

  it("FIN-REG-11 registered workspace types include denali and finance-ws*", () => {
    assert.deepEqual(listRegisteredFinanceWorkspaceTypes(), [
      "alpine",
      DENALI,
      WS2,
      "finance-ws3",
      "finance-ws4",
      "finance-ws5",
      "finance-ws6",
    ]);
  });

  it("FIN-REG-12 booking projection resolves BookingPaymentAdapter for denali and finance-ws2", () => {
    assert.ok(resolveFinanceBookingPayments(DENALI) instanceof BookingPaymentAdapter);
    assert.ok(resolveFinanceBookingPayments(WS2) instanceof BookingPaymentAdapter);
  });

  it("FIN-REG-13 booking projection fails closed for unsupported workspaceType", () => {
    assert.throws(
      () => resolveFinanceBookingPayments("urban"),
      (error: unknown) =>
        error instanceof Error && error.message.startsWith("FINANCE_BOOKING_PAYMENT_UNSUPPORTED:")
    );
  });

  it("FIN-REG-14 denali registers a finance-service decorator; ws2 does not", async () => {
    const denali = await resolveFinanceWorkspaceDependencies(DENALI);
    const ws2 = await resolveFinanceWorkspaceDependencies(WS2);
    assert.equal(typeof denali.decorateFinanceService, "function");
    assert.equal(ws2.decorateFinanceService, undefined);
  });

  it("FIN-REG-15 denali decorator preserves finance return values", async () => {
    const denali = await resolveFinanceWorkspaceDependencies(DENALI);
    assert.equal(typeof denali.decorateFinanceService, "function");

    const service = {
      async createManualPayment() {
        return { paymentId: "p-1", status: "pending" as const };
      },
      async submitReceipt() {
        return { receiptId: "r-1", status: "submitted" as const };
      },
      async reviewReceipt() {
        return { receiptId: "r-1", status: "approved" as const };
      },
      async getRegistrationInvoice() {
        return { invoiceId: "inv-1", totalMinor: "1000" };
      },
    } as unknown as FinanceService;

    const wrapped = denali.decorateFinanceService!(service, {
      env: { FINANCE_CASE_SHADOW_ENABLED: "false" },
      bookings: {
        async getById() {
          return null;
        },
      },
      finance: {
        async findLatestReceiptForRegistration() {
          return null;
        },
        async getRegistrationInvoiceFacts() {
          return {
            prepaymentMinor: "0",
            paidPaymentsMinor: "0",
            paymentAmountsMinor: [],
            currency: "IRR",
          };
        },
        async findPaymentStatusesByRegistration() {
          return [];
        },
        async findFirstPendingManualPayment() {
          return null;
        },
        async listPendingReceipts() {
          return { rows: [], nextCursor: null, hasMore: false };
        },
        async listLedgerEvents() {
          return [];
        },
        async findPaymentById() {
          return null;
        },
        async findReceiptById() {
          return null;
        },
      },
      obligation: {
        async resolveRegistrationObligation() {
          return { currency: "IRR", obligationMinor: "1000", source: "tour_canonical" as const };
        },
        async resolveRegistrationPaymentCollection() {
          return "offline" as const;
        },
      },
    });

    assert.equal(wrapped, service);
    assert.deepEqual(
      await wrapped.createManualPayment(
        { tenantId: "t-1", userId: "u-1", roles: [] } as never,
        { registrationId: "reg-1" } as never,
        "idem-1"
      ),
      { paymentId: "p-1", status: "pending" }
    );
    assert.deepEqual(
      await wrapped.submitReceipt(
        { tenantId: "t-1", userId: "u-1", roles: [] } as never,
        { paymentId: "pay-1" } as never,
        "idem-2"
      ),
      { receiptId: "r-1", status: "submitted" }
    );
    assert.deepEqual(
      await wrapped.reviewReceipt(
        { tenantId: "t-1", userId: "u-1", roles: [] } as never,
        "receipt-1",
        { decision: "Approved" } as never
      ),
      { receiptId: "r-1", status: "approved" }
    );
    assert.deepEqual(
      await wrapped.getRegistrationInvoice(
        { tenantId: "t-1", userId: "u-1", roles: [] } as never,
        "reg-1"
      ),
      { invoiceId: "inv-1", totalMinor: "1000" }
    );
  });
});
