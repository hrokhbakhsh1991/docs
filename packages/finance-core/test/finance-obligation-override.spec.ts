/**
 * Phase 5 — per-registration obligation override / zero waive.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";

import type { FinanceObligationPort } from "@app-tour/finance-http-contracts";

import { createFinanceService } from "../src/application/finance.service.ts";
import {
  buildObligationOverrideIntakeValue,
  isZeroObligationMinor,
  OBLIGATION_OVERRIDE_INTAKE_KEY,
  readObligationOverrideFromIntake,
} from "../src/domain/obligation-override.ts";
import type { FinanceActorContext } from "../src/ports/finance-actor-context.ts";
import type {
  BookingPaymentSyncStatus,
  IBookingPaymentPort,
} from "../src/ports/booking-payment.port.ts";
import {
  FakeAuthz,
  FakeCapability,
  FakeClock,
  FakeDisplay,
  FakeLogger,
  FakeMetrics,
  FakeProof,
  FakeReceiptDefaults,
  FakeSchedules,
  FakeStorage,
  createFakeLedgerPolicy,
} from "./isolation/fakes.ts";
import {
  InMemoryFinanceRepository,
  resetInMemoryFinanceRepositoryForTests,
} from "./isolation/in-memory-finance.repository.ts";

const TENANT = "00000000-0000-4000-8000-0000000000dd";
const OWNER = "00000000-0000-4000-8000-000000000031";
const OPS = "00000000-0000-4000-8000-000000000032";

function opsAuth(): FinanceActorContext {
  return {
    userId: OPS,
    tenantId: TENANT,
    role: "admin",
    status: "ACTIVE",
    workspaceId: "ws-disc",
  };
}

function memberAuth(): FinanceActorContext {
  return {
    userId: OWNER,
    tenantId: TENANT,
    role: "member",
    status: "ACTIVE",
    workspaceId: "ws-disc",
  };
}

function projectionPort(paymentStatusRef: {
  value: BookingPaymentSyncStatus;
}): IBookingPaymentPort {
  return {
    async syncStatus(input) {
      paymentStatusRef.value = input.paymentStatus;
      return paymentStatusRef.value;
    },
    async raisePaidInTx() {
      paymentStatusRef.value = "paid";
      return "paid";
    },
    async memberOwnsRegistration(input) {
      return input.tenantId === TENANT && input.userId === OWNER;
    },
    async getPaymentStatus() {
      return paymentStatusRef.value;
    },
    async getRegistrationLifecycleStatus() {
      return "approved";
    },
  };
}

function obligationPort(intakeRef: { value: Record<string, unknown> }): FinanceObligationPort {
  return {
    async resolveRegistrationObligation() {
      const override = readObligationOverrideFromIntake(intakeRef.value);
      if (override !== null) {
        return {
          currency: "IRR",
          obligationMinor: override.obligationMinor,
          source: "operator_override",
        };
      }
      return { currency: "IRR", obligationMinor: "9000000", source: "tour_canonical" };
    },
    async resolveRegistrationPaymentCollection() {
      return "offline";
    },
    async setRegistrationObligationOverride(input) {
      intakeRef.value = {
        ...intakeRef.value,
        [OBLIGATION_OVERRIDE_INTAKE_KEY]: buildObligationOverrideIntakeValue({
          obligationMinor: input.obligationMinor,
          setAt: input.setAt,
          setByUserId: input.setByUserId,
          ...(input.reason !== undefined ? { reason: input.reason } : {}),
        }),
      };
      return true;
    },
  };
}

describe("obligation-override pure helpers", () => {
  it("reads and builds override intake", () => {
    const built = buildObligationOverrideIntakeValue({
      obligationMinor: "1000",
      reason: "vip",
      setAt: "2026-08-06T00:00:00.000Z",
      setByUserId: OPS,
    });
    const read = readObligationOverrideFromIntake({
      [OBLIGATION_OVERRIDE_INTAKE_KEY]: built,
    });
    assert.equal(read?.obligationMinor, "1000");
    assert.equal(read?.reason, "vip");
    assert.equal(isZeroObligationMinor("0"), true);
    assert.equal(isZeroObligationMinor("10"), false);
  });
});

describe("FIN-OBL-OVERRIDE phase 5", () => {
  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
  });

  it("setRegistrationObligationOverride stores override and uses it for receipt amount", async () => {
    const registrationId = randomUUID();
    const intakeRef = { value: {} as Record<string, unknown> };
    const paymentStatusRef = { value: "unpaid" as BookingPaymentSyncStatus };
    const booking = projectionPort(paymentStatusRef);
    const obligation = obligationPort(intakeRef);

    const repo = new InMemoryFinanceRepository(booking);
    const finance = createFinanceService(
      createFakeLedgerPolicy(),
      repo,
      booking,
      FakeReceiptDefaults,
      FakeDisplay,
      FakeMetrics,
      FakeStorage,
      FakeProof,
      FakeCapability,
      FakeAuthz,
      FakeSchedules,
      FakeLogger,
      FakeClock,
      obligation
    );

    await finance.setRegistrationObligationOverride(opsAuth(), {
      registrationId,
      obligationMinor: "4500000",
      reason: "loyalty",
    });

    await finance.submitMemberReceiptForRegistration(memberAuth(), {
      registrationId,
      fileKey: `receipts/${TENANT}/${registrationId}/disc.pdf`,
    });
    const payment = await repo.findFirstPendingManualPayment(TENANT, registrationId);
    assert.ok(payment !== null);
    assert.equal(payment.amount, "4500000");
  });

  it("zero override on approved booking marks paid and blocks receipt", async () => {
    const registrationId = randomUUID();
    const intakeRef = { value: {} as Record<string, unknown> };
    const paymentStatusRef = { value: "unpaid" as BookingPaymentSyncStatus };
    const booking = projectionPort(paymentStatusRef);
    const obligation = obligationPort(intakeRef);

    const repo = new InMemoryFinanceRepository(booking);
    const finance = createFinanceService(
      createFakeLedgerPolicy(),
      repo,
      booking,
      FakeReceiptDefaults,
      FakeDisplay,
      FakeMetrics,
      FakeStorage,
      FakeProof,
      FakeCapability,
      FakeAuthz,
      FakeSchedules,
      FakeLogger,
      FakeClock,
      obligation
    );

    const result = await finance.setRegistrationObligationOverride(opsAuth(), {
      registrationId,
      obligationMinor: "0",
      reason: "comp",
    });
    assert.equal(result.freePaidApplied, true);
    assert.equal(paymentStatusRef.value, "paid");

    await assert.rejects(
      () =>
        finance.submitMemberReceiptForRegistration(memberAuth(), {
          registrationId,
          fileKey: `receipts/${TENANT}/${registrationId}/x.pdf`,
        }),
      /FINANCE_RECEIPT_NOT_REQUIRED/
    );
  });
});
