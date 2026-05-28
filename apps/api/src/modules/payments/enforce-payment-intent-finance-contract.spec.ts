import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadRequestException } from "@nestjs/common";
import { PaymentStatus } from "@repo/shared-contracts";

import { enforcePaymentIntentFinanceContract } from "./enforce-payment-intent-finance-contract";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const TENANT_UUID = "22222222-2222-4222-8222-222222222222";
const REGISTRATION_UUID = "33333333-3333-4333-8333-333333333333";

function validApplyPaymentStatusPayload(status: PaymentStatus) {
  return {
    id: VALID_UUID,
    tenantId: TENANT_UUID,
    registrationId: REGISTRATION_UUID,
    amount: "150000",
    currency: "IRR",
    method: "Online",
    provider: "zibal",
    providerPaymentId: "provider-ref-1",
    status,
    paidAt: null,
    failedAt: null,
    refundedAt: null,
    ledgerJournalId: null,
    createdAt: "2026-01-15T10:00:00.000Z",
    updatedAt: "2026-01-15T10:05:00.000Z",
    deletedAt: null,
  };
}

describe("enforcePaymentIntentFinanceContract", () => {
  it("allows valid applyPaymentStatus payloads for Paid and Failed transitions", () => {
    assert.doesNotThrow(() =>
      enforcePaymentIntentFinanceContract(
        validApplyPaymentStatusPayload(PaymentStatus.PAID),
        "applyPaymentStatus:Paid",
      ),
    );
    assert.doesNotThrow(() =>
      enforcePaymentIntentFinanceContract(
        validApplyPaymentStatusPayload(PaymentStatus.FAILED),
        "applyPaymentStatus:Failed",
      ),
    );
  });

  it("throws FINANCE_CONTRACT_VALIDATION_FAILED when id is not a UUID", () => {
    try {
      enforcePaymentIntentFinanceContract(
        {
          ...validApplyPaymentStatusPayload(PaymentStatus.PENDING),
          id: "not-a-valid-uuid",
        },
        "applyPaymentStatus:Pending",
      );
      assert.fail("expected BadRequestException");
    } catch (error: unknown) {
      assert.ok(error instanceof BadRequestException);
      const body = (error as BadRequestException).getResponse() as {
        error?: { code?: string; message?: string };
      };
      assert.equal(body.error?.code, "FINANCE_CONTRACT_VALIDATION_FAILED");
      assert.match(body.error?.message ?? "", /applyPaymentStatus:Pending/);
    }
  });

  it("allows valid createManualPayment wire (Manual provider, no PSP id)", () => {
    assert.doesNotThrow(() =>
      enforcePaymentIntentFinanceContract(
        {
          tenantId: TENANT_UUID,
          registrationId: REGISTRATION_UUID,
          amount: "1000",
          currency: "IRR",
          method: "Manual",
          provider: "manual",
          providerPaymentId: null,
          status: PaymentStatus.PENDING,
          paidAt: null,
          failedAt: null,
          refundedAt: null,
          ledgerJournalId: null,
        },
        "createManualPayment",
      ),
    );
  });

  it("throws FINANCE_CONTRACT_VALIDATION_FAILED when currency format is invalid", () => {
    try {
      enforcePaymentIntentFinanceContract(
        {
          ...validApplyPaymentStatusPayload(PaymentStatus.REFUNDED),
          currency: "X",
        },
        "applyPaymentStatus:Refunded",
      );
      assert.fail("expected BadRequestException");
    } catch (error: unknown) {
      assert.ok(error instanceof BadRequestException);
      const body = (error as BadRequestException).getResponse() as { error?: { code?: string } };
      assert.equal(body.error?.code, "FINANCE_CONTRACT_VALIDATION_FAILED");
    }
  });
});
