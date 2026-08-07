/**
 * Approve-then-pay — member receipt submit requires booking.status=approved.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";

import { createFinanceService } from "../src/application/finance.service.ts";
import type { FinanceActorContext } from "../src/ports/finance-actor-context.ts";
import type {
  BookingPaymentLifecycleStatus,
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

const TENANT = "00000000-0000-4000-8000-0000000000aa";
const OWNER = "00000000-0000-4000-8000-000000000001";

function memberAuth(): FinanceActorContext {
  return {
    userId: OWNER,
    tenantId: TENANT,
    role: "member",
    status: "ACTIVE",
    workspaceId: "ws-gate",
  };
}

function createLifecycleBookingPort(
  lifecycle: BookingPaymentLifecycleStatus
): IBookingPaymentPort {
  return {
    async syncStatus(input) {
      return input.paymentStatus;
    },
    async raisePaidInTx() {
      return "paid";
    },
    async memberOwnsRegistration(input) {
      return input.tenantId === TENANT && input.userId === OWNER;
    },
    async getPaymentStatus() {
      return "unpaid";
    },
    async getRegistrationLifecycleStatus() {
      return lifecycle;
    },

  };
}

describe("FIN-RECEIPT-GATE approve-then-pay", () => {
  beforeEach(() => {
    resetInMemoryFinanceRepositoryForTests();
  });

  for (const lifecycle of ["pending", "waitlisted", "rejected", "cancelled"] as const) {
    it(`rejects member receipt when booking is ${lifecycle}`, async () => {
      const registrationId = randomUUID();
      const booking = createLifecycleBookingPort(lifecycle);
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
        FakeClock
      );

      await assert.rejects(
        () =>
          finance.submitMemberReceiptForRegistration(memberAuth(), {
            registrationId,
            fileKey: `receipts/${TENANT}/${registrationId}/early.pdf`,
          }),
        (err: unknown) =>
          err instanceof Error && err.message === "FINANCE_RECEIPT_REQUIRES_APPROVED_BOOKING"
      );
    });
  }

  it("allows member receipt when booking is approved", async () => {
    const registrationId = randomUUID();
    const booking = createLifecycleBookingPort("approved");
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
      FakeClock
    );

    const receipt = await finance.submitMemberReceiptForRegistration(memberAuth(), {
      registrationId,
      fileKey: `receipts/${TENANT}/${registrationId}/ok.pdf`,
    });
    assert.equal(receipt.status, "Pending");
    assert.equal(receipt.fileKey, `receipts/${TENANT}/${registrationId}/ok.pdf`);
  });
});
