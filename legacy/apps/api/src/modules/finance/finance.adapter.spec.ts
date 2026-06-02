import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PaymentStatus } from "@repo/shared-contracts";
import {
  normalizeLegacyPaymentIntentWire,
  toFinanceContract,
} from "./finance.adapter";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const TENANT_UUID = "22222222-2222-4222-8222-222222222222";
const REGISTRATION_UUID = "33333333-3333-4333-8333-333333333333";

describe("finance.adapter", () => {
  it("toFinanceContract validates a full legacy wire payload", () => {
    const legacy = {
      id: VALID_UUID,
      tenantId: TENANT_UUID,
      registrationId: REGISTRATION_UUID,
      amount: "150000",
      currency: "irr",
      method: "Online",
      provider: "zibal",
      providerPaymentId: null,
      status: PaymentStatus.PENDING,
      paidAt: null,
      failedAt: null,
      refundedAt: null,
      ledgerJournalId: null,
      createdAt: "2026-01-15T10:00:00.000Z",
      updatedAt: "2026-01-15T10:05:00.000Z",
    };

    const contract = toFinanceContract(legacy);
    assert.equal(contract.id, VALID_UUID);
    assert.equal(contract.currency, "IRR");
    assert.equal(contract.status, "Pending");
  });

  it("normalizeLegacyPaymentIntentWire maps snake_case fields", () => {
    const wire = normalizeLegacyPaymentIntentWire({
      id: VALID_UUID,
      tenant_id: TENANT_UUID,
      registration_id: REGISTRATION_UUID,
      amount: "99",
      currency: "usd",
      method: "Manual",
      provider: "manual",
      status: "Paid",
      paid_at: "2026-02-01T12:00:00.000Z",
      created_at: "2026-02-01T11:00:00.000Z",
      updated_at: "2026-02-01T12:00:00.000Z",
    });

    assert.equal(wire.tenantId, TENANT_UUID);
    assert.equal(wire.registrationId, REGISTRATION_UUID);
    assert.equal(wire.currency, "USD");
    assert.equal(wire.status, "Paid");
    assert.equal(wire.paidAt, "2026-02-01T12:00:00.000Z");
  });

  it("toFinanceContract normalizes partial pre-persist snapshots with default timestamps", () => {
    const partial = {
      id: VALID_UUID,
      tenantId: TENANT_UUID,
      registrationId: REGISTRATION_UUID,
      amount: "150000",
      currency: "IRR",
      method: "Online",
      provider: "zibal",
      status: PaymentStatus.PENDING,
    };

    assert.doesNotThrow(() => {
      const contract = toFinanceContract(partial);
      assert.equal(contract.id, VALID_UUID);
      assert.equal(contract.amount, "150000");
    });
  });
});
